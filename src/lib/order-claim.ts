import crypto from "crypto";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { awardOrderPointsIfEligibleTx } from "./loyalty";

const ORDER_CLAIM_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getClaimSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "CRITICAL: JWT_SECRET must be set and at least 32 characters in production"
      );
    }
    return secret;
  }
  return secret || "travelvn-fallback-dev-secret-change-in-prod";
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.trim().replace(/[\s.-]/g, "");
  return cleaned
    .replace(/^\+840?/, "0")
    .replace(/^840?(?=\d{9,10}$)/, "0");
}

export interface OrderClaimTokenPayload {
  orderId: string;
  orderCode: string;
  email: string;
  phone: string;
  exp: number;
}

export function signOrderClaimToken(payload: {
  orderId: string;
  orderCode: string;
  email: string;
  phone: string;
}): string {
  const normalized: OrderClaimTokenPayload = {
    orderId: payload.orderId.trim(),
    orderCode: payload.orderCode.trim().toUpperCase(),
    email: payload.email.trim().toLowerCase(),
    phone: normalizePhone(payload.phone),
    exp: Date.now() + ORDER_CLAIM_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(normalized), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getClaimSecret())
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${sig}`;
}

export function verifyOrderClaimToken(
  token: string
): OrderClaimTokenPayload | null {
  try {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [encoded, providedSig] = parts;

    const expectedSig = crypto
      .createHmac("sha256", getClaimSecret())
      .update(encoded)
      .digest("base64url");

    const expectedBuf = Buffer.from(expectedSig, "utf8");
    const providedBuf = Buffer.from(providedSig, "utf8");

    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<OrderClaimTokenPayload>;

    if (
      typeof decoded.orderId !== "string" ||
      !decoded.orderId ||
      typeof decoded.orderCode !== "string" ||
      !decoded.orderCode ||
      typeof decoded.email !== "string" ||
      !decoded.email ||
      typeof decoded.phone !== "string" ||
      !decoded.phone ||
      typeof decoded.exp !== "number" ||
      !Number.isFinite(decoded.exp) ||
      decoded.exp <= Date.now()
    ) {
      return null;
    }

    return {
      orderId: decoded.orderId,
      orderCode: decoded.orderCode,
      email: decoded.email,
      phone: decoded.phone,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

export type OrderClaimErrorCode =
  | "INVALID_TOKEN"
  | "NOT_FOUND"
  | "ALREADY_CLAIMED"
  | "PHONE_MISMATCH";

export class OrderClaimError extends Error {
  readonly code: OrderClaimErrorCode;
  readonly status: number;

  constructor(code: OrderClaimErrorCode, message?: string) {
    const defaults: Record<
      OrderClaimErrorCode,
      { msg: string; status: number }
    > = {
      INVALID_TOKEN: {
        msg: "Liên kết lưu đơn hàng không hợp lệ hoặc đã hết hạn.",
        status: 400,
      },
      NOT_FOUND: {
        msg: "Không tìm thấy đơn đặt tour phù hợp.",
        status: 404,
      },
      ALREADY_CLAIMED: {
        msg: "Đơn đặt tour này đã được liên kết với một tài khoản.",
        status: 409,
      },
      PHONE_MISMATCH: {
        msg: "Số điện thoại không khớp với thông tin đơn đặt tour.",
        status: 403,
      },
    };
    super(message ?? defaults[code].msg);
    this.name = "OrderClaimError";
    this.code = code;
    this.status = defaults[code].status;
  }
}

export async function claimVerifiedEmailOrdersTx(
  tx: Prisma.TransactionClient,
  userId: string,
  verifiedEmail: string
): Promise<{
  claimedCount: number;
  claimedOrderIds: string[];
  pointsAwarded: number;
}> {
  const normalizedEmail = verifiedEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    return { claimedCount: 0, claimedOrderIds: [], pointsAwarded: 0 };
  }

  const candidateOrders = await tx.order.findMany({
    where: {
      userId: null,
      deleted: false,
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  const claimedOrderIds: string[] = [];
  let pointsAwarded = 0;

  for (const candidate of candidateOrders) {
    const updated = await tx.order.updateMany({
      where: {
        id: candidate.id,
        userId: null,
        deleted: false,
      },
      data: { userId },
    });

    if (updated.count === 1) {
      claimedOrderIds.push(candidate.id);
      const award = await awardOrderPointsIfEligibleTx(tx, candidate.id);
      if (award.awarded) {
        pointsAwarded += award.points;
      }
    }
  }

  return {
    claimedCount: claimedOrderIds.length,
    claimedOrderIds,
    pointsAwarded,
  };
}

export async function claimSingleGuestOrderTx(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    claimToken?: string;
    orderCode?: string;
    phone?: string;
  }
): Promise<{
  order: {
    id: string;
    code: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    total: number;
    pointsEarned: number;
  };
  pointsAwarded: number;
}> {
  let targetOrder: {
    id: string;
    code: string;
    userId: string | null;
    phone: string;
    email: string | null;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    total: number;
    pointsEarned: number;
  } | null = null;

  if (params.claimToken) {
    const parsed = verifyOrderClaimToken(params.claimToken);
    if (!parsed) {
      throw new OrderClaimError("INVALID_TOKEN");
    }

    targetOrder = await tx.order.findFirst({
      where: {
        id: parsed.orderId,
        deleted: false,
      },
      select: {
        id: true,
        code: true,
        userId: true,
        phone: true,
        email: true,
        status: true,
        paymentStatus: true,
        total: true,
        pointsEarned: true,
      },
    });

    if (!targetOrder) {
      throw new OrderClaimError("NOT_FOUND");
    }

    if (
      targetOrder.code !== parsed.orderCode ||
      normalizePhone(targetOrder.phone) !== normalizePhone(parsed.phone) ||
      (targetOrder.email ?? "").trim().toLowerCase() !== parsed.email
    ) {
      throw new OrderClaimError("INVALID_TOKEN");
    }

    if (targetOrder.userId !== null) {
      throw new OrderClaimError("ALREADY_CLAIMED");
    }
  } else {
    const normalizedCode = (params.orderCode ?? "").trim().toUpperCase();
    const normalizedInputPhone = normalizePhone(params.phone ?? "");

    if (!normalizedCode || !normalizedInputPhone) {
      throw new OrderClaimError("NOT_FOUND");
    }

    targetOrder = await tx.order.findFirst({
      where: {
        code: normalizedCode,
        deleted: false,
      },
      select: {
        id: true,
        code: true,
        userId: true,
        phone: true,
        email: true,
        status: true,
        paymentStatus: true,
        total: true,
        pointsEarned: true,
      },
    });

    if (!targetOrder) {
      throw new OrderClaimError("NOT_FOUND");
    }

    // Check PHONE_MISMATCH before ALREADY_CLAIMED to prevent probing order claim state.
    if (normalizePhone(targetOrder.phone) !== normalizedInputPhone) {
      throw new OrderClaimError("PHONE_MISMATCH");
    }

    if (targetOrder.userId !== null) {
      throw new OrderClaimError("ALREADY_CLAIMED");
    }
  }

  const claimed = await tx.order.updateMany({
    where: {
      id: targetOrder.id,
      userId: null,
      deleted: false,
    },
    data: { userId: params.userId },
  });

  if (claimed.count === 0) {
    throw new OrderClaimError("ALREADY_CLAIMED");
  }

  const award = await awardOrderPointsIfEligibleTx(tx, targetOrder.id);

  return {
    order: {
      id: targetOrder.id,
      code: targetOrder.code,
      status: targetOrder.status,
      paymentStatus: targetOrder.paymentStatus,
      total: targetOrder.total,
      pointsEarned: award.awarded ? award.points : targetOrder.pointsEarned,
    },
    pointsAwarded: award.awarded ? award.points : 0,
  };
}
