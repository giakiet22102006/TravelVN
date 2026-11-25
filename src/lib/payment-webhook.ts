import crypto from "crypto";
import {
  OrderStatus,
  PaymentStatus,
  type Prisma,
  RecordStatus,
  RefundStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reserveOrderItemStock } from "@/lib/order-holds";
import { revalidateClientToursCache } from "@/lib/cache-tags";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { awardOrderPointsIfEligibleTx } from "@/lib/loyalty";

class LatePaidRollbackError extends Error {
  constructor() {
    super("LATE_PAID_INSUFFICIENT_STOCK");
  }
}

export async function reconcileRedeemedPointsOnReopenTx(
  tx: Prisma.TransactionClient,
  order: { id: string; userId: string | null; pointsRedeemed: number }
): Promise<{ reconciled: boolean; insufficient: boolean }> {
  if (!order.userId || order.pointsRedeemed <= 0) {
    return { reconciled: true, insufficient: false };
  }

  await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;

  const refundTx = await tx.loyaltyTransaction.findFirst({
    where: {
      userId: order.userId,
      orderId: order.id,
      type: "ORDER_REDEEM_REFUND",
    },
    select: { id: true },
  });

  if (!refundTx) {
    return { reconciled: true, insufficient: false };
  }

  const deducted = await tx.user.updateMany({
    where: {
      id: order.userId,
      deleted: false,
      status: RecordStatus.ACTIVE,
      loyaltyPoints: { gte: order.pointsRedeemed },
    },
    data: {
      loyaltyPoints: { decrement: order.pointsRedeemed },
    },
  });

  if (deducted.count === 0) {
    return { reconciled: false, insufficient: true };
  }

  await tx.loyaltyTransaction.delete({
    where: { id: refundTx.id },
  });

  return { reconciled: true, insufficient: false };
}

export function getPaymentWebhookSecret(): string {
  return (
    process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.JWT_SECRET ||
    "dev-payment-webhook-secret"
  );
}

export function signWebhookPayload(rawBody: string): string {
  return crypto
    .createHmac("sha256", getPaymentWebhookSecret())
    .update(rawBody)
    .digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  providedSig: string
): boolean {
  const normalized = providedSig.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
    return false;
  }

  const expectedHex = signWebhookPayload(rawBody);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const providedBuf = Buffer.from(normalized, "hex");

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function isPaymentSandboxEnabled(): boolean {
  return (
    process.env.ENABLE_PAYMENT_SANDBOX === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export interface WebhookProcessResult {
  status: number;
  body: Record<string, unknown>;
}

async function upsertWebhookLog(
  client: Prisma.TransactionClient | typeof prisma,
  data: {
    provider: string;
    eventId: string;
    orderCode: string;
    amount: number;
    signatureValid: boolean;
    outcome: string;
    payload: Prisma.InputJsonValue;
  }
): Promise<void> {
  await client.paymentWebhookLog.upsert({
    where: { eventId: data.eventId },
    create: data,
    update: {
      provider: data.provider,
      orderCode: data.orderCode,
      amount: data.amount,
      signatureValid: data.signatureValid,
      outcome: data.outcome,
      payload: data.payload,
    },
  });
}

export async function processSignedPaymentWebhook(
  rawBody: string,
  signatureHeader: string
): Promise<WebhookProcessResult> {
  let parsed: Record<string, unknown> | null = null;
  try {
    const raw = JSON.parse(rawBody);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      parsed = raw as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }

  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    if (
      parsed &&
      typeof parsed.eventId === "string" &&
      parsed.eventId.trim()
    ) {
      const eventId = parsed.eventId.trim();
      const orderCode =
        typeof parsed.orderCode === "string" ? parsed.orderCode.trim() : "";
      const rawAmt = Number(parsed.amount);
      const amount =
        Number.isFinite(rawAmt) && rawAmt > 0 ? Math.floor(rawAmt) : 0;
      const provider =
        typeof parsed.provider === "string" && parsed.provider.trim()
          ? parsed.provider.trim()
          : "SEPAY_VIETQR";

      try {
        await prisma.paymentWebhookLog.create({
          data: {
            provider,
            eventId,
            orderCode,
            amount,
            signatureValid: false,
            outcome: "INVALID_SIGNATURE",
            payload: parsed as Prisma.InputJsonValue,
          },
        });
      } catch {
        // Ignore duplicate eventId or log failures on invalid signature attempts
      }
    }

    return {
      status: 401,
      body: { message: "Chữ ký webhook không hợp lệ" },
    };
  }

  if (!parsed) {
    return {
      status: 400,
      body: { message: "Payload JSON không hợp lệ" },
    };
  }

  const eventId =
    typeof parsed.eventId === "string" ? parsed.eventId.trim() : "";
  const orderCode =
    typeof parsed.orderCode === "string" ? parsed.orderCode.trim() : "";
  const rawAmount = Number(parsed.amount);
  const provider =
    typeof parsed.provider === "string" && parsed.provider.trim()
      ? parsed.provider.trim()
      : "SEPAY_VIETQR";

  if (!eventId || !orderCode || !Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {
      status: 400,
      body: {
        message: "Thiếu dữ liệu webhook hợp lệ (eventId, orderCode, amount > 0)",
      },
    };
  }

  const amount = Math.floor(rawAmount);
  const payloadJson = parsed as Prisma.InputJsonValue;

  const existing = await prisma.paymentWebhookLog.findUnique({
    where: { eventId },
  });
  if (existing && existing.signatureValid) {
    return {
      status: 200,
      body: { ok: true, duplicate: true, outcome: existing.outcome },
    };
  }

  let txResult: {
    status: number;
    body: Record<string, unknown>;
    shouldRevalidate: boolean;
    emailTarget?: {
      to: string | null;
      orderCode: string;
      fullName: string;
      phone: string;
      total: number;
      paymentStatus: string;
      items: Array<{
        name: string;
        departureLocation: string;
        departureDate: Date | null;
        quantityAdult: number;
        quantityChild: number;
        quantityBaby: number;
      }>;
    };
  };

  try {
    txResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "code" = ${orderCode} AND "deleted" = false FOR UPDATE`;

      const order = await tx.order.findFirst({
        where: { code: orderCode, deleted: false },
        include: { items: true },
      });

      if (!order) {
        await upsertWebhookLog(tx, {
          provider,
          eventId,
          orderCode,
          amount,
          signatureValid: true,
          outcome: "ORDER_NOT_FOUND",
          payload: payloadJson,
        });
        return {
          status: 404,
          body: {
            ok: false,
            outcome: "ORDER_NOT_FOUND",
            message: "Không tìm thấy đơn hàng",
          },
          shouldRevalidate: false,
        };
      }

      if (amount < order.total) {
        await upsertWebhookLog(tx, {
          provider,
          eventId,
          orderCode,
          amount,
          signatureValid: true,
          outcome: "INSUFFICIENT_AMOUNT",
          payload: payloadJson,
        });
        return {
          status: 400,
          body: {
            ok: false,
            outcome: "INSUFFICIENT_AMOUNT",
            message: "Số tiền thanh toán chưa đủ tổng đơn hàng",
          },
          shouldRevalidate: false,
        };
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        await upsertWebhookLog(tx, {
          provider,
          eventId,
          orderCode,
          amount,
          signatureValid: true,
          outcome: "ALREADY_PAID",
          payload: payloadJson,
        });
        return {
          status: 200,
          body: { ok: true, duplicate: true, outcome: "ALREADY_PAID" },
          shouldRevalidate: false,
        };
      }

      if (order.status !== OrderStatus.CANCELLED) {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.APPROVED,
            paymentStatus: PaymentStatus.PAID,
            refundStatus: RefundStatus.NONE,
            paidAt: new Date(),
            paymentRef: eventId,
          },
        });

        await awardOrderPointsIfEligibleTx(tx, updated.id);

        await upsertWebhookLog(tx, {
          provider,
          eventId,
          orderCode,
          amount,
          signatureValid: true,
          outcome: "PAID_APPROVED",
          payload: payloadJson,
        });

        return {
          status: 200,
          body: { ok: true, outcome: "PAID_APPROVED", orderCode },
          shouldRevalidate: true,
          emailTarget: {
            to: updated.email,
            orderCode: updated.code,
            fullName: updated.fullName,
            phone: updated.phone,
            total: updated.total,
            paymentStatus: updated.paymentStatus,
            items: order.items,
          },
        };
      }

      // Late webhook race condition: order was already CANCELLED (e.g. hold expired).
      // Re-reserve stock atomically across ALL items; throw sentinel on any failure
      // so PostgreSQL rolls back all earlier decrements with zero partial leaks.
      for (const item of order.items) {
        if (!item.tourId) {
          throw new LatePaidRollbackError();
        }
        const ok = await reserveOrderItemStock(tx, {
          tourId: item.tourId,
          departureId: item.departureId,
          quantityAdult: item.quantityAdult,
          quantityChild: item.quantityChild,
          quantityBaby: item.quantityBaby,
        });
        if (!ok) {
          throw new LatePaidRollbackError();
        }
      }

      const reconcile = await reconcileRedeemedPointsOnReopenTx(tx, {
        id: order.id,
        userId: order.userId,
        pointsRedeemed: order.pointsRedeemed,
      });
      if (reconcile.insufficient) {
        throw new LatePaidRollbackError();
      }

      const reapproved = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.APPROVED,
          paymentStatus: PaymentStatus.PAID,
          refundStatus: RefundStatus.NONE,
          paidAt: new Date(),
          paymentRef: eventId,
          cancelReason: null,
        },
      });

      await awardOrderPointsIfEligibleTx(tx, reapproved.id);

      await upsertWebhookLog(tx, {
        provider,
        eventId,
        orderCode,
        amount,
        signatureValid: true,
        outcome: "LATE_PAID_REAPPROVED",
        payload: payloadJson,
      });

      return {
        status: 200,
        body: { ok: true, outcome: "LATE_PAID_REAPPROVED", orderCode },
        shouldRevalidate: true,
        emailTarget: {
          to: reapproved.email,
          orderCode: reapproved.code,
          fullName: reapproved.fullName,
          phone: reapproved.phone,
          total: reapproved.total,
          paymentStatus: reapproved.paymentStatus,
          items: order.items,
        },
      };
    });
  } catch (err) {
    if (!(err instanceof LatePaidRollbackError)) {
      throw err;
    }

    // Re-reservation rolled back cleanly; record PAID + REFUND_REQUIRED on cancelled order
    txResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "code" = ${orderCode} AND "deleted" = false FOR UPDATE`;

      const order = await tx.order.findFirst({
        where: { code: orderCode, deleted: false },
      });

      if (!order) {
        await upsertWebhookLog(tx, {
          provider,
          eventId,
          orderCode,
          amount,
          signatureValid: true,
          outcome: "ORDER_NOT_FOUND",
          payload: payloadJson,
        });
        return {
          status: 404,
          body: {
            ok: false,
            outcome: "ORDER_NOT_FOUND",
            message: "Không tìm thấy đơn hàng",
          },
          shouldRevalidate: false,
        };
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        await upsertWebhookLog(tx, {
          provider,
          eventId,
          orderCode,
          amount,
          signatureValid: true,
          outcome: "ALREADY_PAID",
          payload: payloadJson,
        });
        return {
          status: 200,
          body: { ok: true, duplicate: true, outcome: "ALREADY_PAID" },
          shouldRevalidate: false,
        };
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.PAID,
          refundStatus: RefundStatus.REFUND_REQUIRED,
          paidAt: new Date(),
          paymentRef: eventId,
        },
      });

      await upsertWebhookLog(tx, {
        provider,
        eventId,
        orderCode,
        amount,
        signatureValid: true,
        outcome: "LATE_PAID_REFUND_REQUIRED",
        payload: payloadJson,
      });

      return {
        status: 200,
        body: { ok: true, outcome: "LATE_PAID_REFUND_REQUIRED", orderCode },
        shouldRevalidate: true,
      };
    });
  }

  if (txResult.shouldRevalidate) {
    revalidateClientToursCache();
  }

  if (txResult.emailTarget?.to) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const voucherUrl = `${baseUrl}/orders/${encodeURIComponent(
      txResult.emailTarget.orderCode
    )}/voucher?phone=${encodeURIComponent(txResult.emailTarget.phone)}`;

    try {
      await sendOrderConfirmationEmail({
        to: txResult.emailTarget.to,
        orderCode: txResult.emailTarget.orderCode,
        fullName: txResult.emailTarget.fullName,
        total: txResult.emailTarget.total,
        paymentStatus: txResult.emailTarget.paymentStatus,
        voucherUrl,
        items: txResult.emailTarget.items,
      });
    } catch {
      // Email failure must never fail webhook processing
    }
  }

  return { status: txResult.status, body: txResult.body };
}
