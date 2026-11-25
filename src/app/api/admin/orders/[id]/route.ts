import { NextRequest, NextResponse } from "next/server";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { restoreOrderInventory } from "@/lib/admin-api";
import { reserveOrderItemStock } from "@/lib/order-holds";
import { revalidateClientToursCache } from "@/lib/cache-tags";
import {
  awardOrderPointsIfEligibleTx,
  refundRedeemedPointsIfAnyTx,
  revokeEarnedPointsOnRefundTx,
} from "@/lib/loyalty";
import { reconcileRedeemedPointsOnReopenTx } from "@/lib/payment-webhook";

class OrderUpdateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("order_view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const item = await prisma.order.findFirst({
      where: { id, deleted: false },
      include: {
        items: true,
        updatedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy đơn hàng" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/orders/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin đơn hàng" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("order_edit");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu cập nhật đơn hàng không hợp lệ" },
          { status: 400 }
        );
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { message: "Payload JSON không hợp lệ" },
        { status: 400 }
      );
    }

    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const email =
      body.email !== undefined
        ? body.email
          ? String(body.email).trim()
          : null
        : undefined;
    const note = body.note ? String(body.note).trim() : null;

    if (!fullName) {
      return NextResponse.json(
        { message: "Tên khách hàng không được để trống" },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { message: "Số điện thoại không được để trống" },
        { status: 400 }
      );
    }

    const paymentMethod = Object.values(PaymentMethod).includes(
      body.paymentMethod as PaymentMethod
    )
      ? (body.paymentMethod as PaymentMethod)
      : PaymentMethod.CASH;
    const paymentStatus = Object.values(PaymentStatus).includes(
      body.paymentStatus as PaymentStatus
    )
      ? (body.paymentStatus as PaymentStatus)
      : PaymentStatus.UNPAID;
    const nextStatus = Object.values(OrderStatus).includes(
      body.status as OrderStatus
    )
      ? (body.status as OrderStatus)
      : OrderStatus.INITIAL;
    const nextRefundStatus = Object.values(RefundStatus).includes(
      body.refundStatus as RefundStatus
    )
      ? (body.refundStatus as RefundStatus)
      : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;

      const existing = await tx.order.findFirst({
        where: { id, deleted: false },
        include: { items: true },
      });

      if (!existing) {
        throw new OrderUpdateError("Không tìm thấy đơn hàng", 404);
      }

      if (
        existing.paymentStatus === PaymentStatus.PAID &&
        paymentStatus === PaymentStatus.UNPAID &&
        (nextStatus === OrderStatus.CANCELLED || Boolean(existing.paymentRef))
      ) {
        throw new OrderUpdateError(
          "Đơn hàng đã được thanh toán trước đó. Vui lòng tải lại trang trước khi cập nhật hoặc hoàn tiền.",
          409
        );
      }

      // Restore tour/departure inventory atomically when cancelling a non-cancelled order
      if (existing.status !== "CANCELLED" && nextStatus === "CANCELLED") {
        await restoreOrderInventory(tx, existing.items);
        await refundRedeemedPointsIfAnyTx(
          tx,
          existing.id,
          "Hoàn điểm do Admin hủy đơn"
        );
      }

      // Re-reserve tour/departure inventory if restoring a cancelled order back to active processing
      if (existing.status === "CANCELLED" && nextStatus !== "CANCELLED") {
        for (const item of existing.items) {
          if (!item.tourId) continue;
          const ok = await reserveOrderItemStock(tx, {
            tourId: item.tourId,
            departureId: item.departureId,
            quantityAdult: item.quantityAdult,
            quantityChild: item.quantityChild,
            quantityBaby: item.quantityBaby,
          });
          if (!ok) {
            throw new OrderUpdateError(
              `Tour "${item.name}" không còn đủ chỗ trống để kích hoạt lại đơn hàng`,
              409
            );
          }
        }

        const reconcile = await reconcileRedeemedPointsOnReopenTx(tx, {
          id: existing.id,
          userId: existing.userId,
          pointsRedeemed: existing.pointsRedeemed,
        });
        if (reconcile.insufficient) {
          throw new OrderUpdateError(
            "Khách hàng không còn đủ điểm thưởng để kích hoạt lại đơn hàng đã hoàn điểm.",
            409
          );
        }
      }

      const cancelReasonUpdate =
        existing.status !== "CANCELLED" && nextStatus === "CANCELLED"
          ? { cancelReason: "ADMIN_CANCELLED" }
          : existing.status === "CANCELLED" && nextStatus !== "CANCELLED"
            ? { cancelReason: null }
            : {};

      const paidAtUpdate =
        existing.paymentStatus !== PaymentStatus.PAID &&
        paymentStatus === PaymentStatus.PAID
          ? { paidAt: existing.paidAt ?? new Date() }
          : {};

      const savedOrder = await tx.order.update({
        where: { id },
        data: {
          fullName,
          phone,
          ...(email !== undefined ? { email } : {}),
          note,
          paymentMethod,
          paymentStatus,
          ...(nextRefundStatus !== undefined
            ? { refundStatus: nextRefundStatus }
            : {}),
          status: nextStatus,
          ...cancelReasonUpdate,
          ...paidAtUpdate,
          updatedById: admin.id,
        },
        include: { items: true },
      });

      const effectiveRefundStatus = nextRefundStatus ?? existing.refundStatus;
      if (
        effectiveRefundStatus === RefundStatus.REFUNDED ||
        nextStatus === OrderStatus.CANCELLED ||
        paymentStatus === PaymentStatus.UNPAID
      ) {
        await revokeEarnedPointsOnRefundTx(tx, existing.id);
        return savedOrder;
      }

      if (
        nextStatus === OrderStatus.APPROVED &&
        paymentStatus === PaymentStatus.PAID
      ) {
        const award = await awardOrderPointsIfEligibleTx(tx, existing.id);
        if (award.awarded) {
          return { ...savedOrder, pointsEarned: award.points };
        }
      }

      return savedOrder;
    });

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Cập nhật đơn hàng thành công!",
      item: updated,
    });
  } catch (error) {
    if (error instanceof OrderUpdateError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    console.error("PUT /api/admin/orders/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật đơn hàng" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("order_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;

      const existing = await tx.order.findFirst({
        where: { id, deleted: false },
        include: { items: true },
      });

      if (!existing) {
        throw new OrderUpdateError("Không tìm thấy đơn hàng", 404);
      }

      if (existing.status !== "CANCELLED") {
        await restoreOrderInventory(tx, existing.items);
        await refundRedeemedPointsIfAnyTx(
          tx,
          existing.id,
          "Hoàn điểm do xóa đơn"
        );
      }

      if (existing.pointsEarned > 0) {
        await revokeEarnedPointsOnRefundTx(tx, existing.id);
      }

      await tx.order.update({
        where: { id },
        data: {
          deleted: true,
          updatedById: admin.id,
        },
      });
    });

    revalidateClientToursCache();

    return NextResponse.json({ message: "Xóa đơn hàng thành công!" });
  } catch (error) {
    if (error instanceof OrderUpdateError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    console.error("DELETE /api/admin/orders/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa đơn hàng" },
      { status: 500 }
    );
  }
}
