import { NextResponse } from "next/server";
import { OrderStatus, PaymentStatus, RefundStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/client-auth";
import {
  ACTIVE_COUPONS,
  evaluateCouponEligibility,
} from "@/lib/knowledge/coupons";
import { computeMemberTier } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import type {
  LoyaltyTransactionItem,
  LoyaltyTransactionType,
} from "@/types/ota";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để xem thông tin thành viên." },
        { status: 401 }
      );
    }

    const [paidOrderCount, rawTransactions] = await Promise.all([
      prisma.order.count({
        where: {
          userId: currentUser.id,
          deleted: false,
          status: OrderStatus.APPROVED,
          paymentStatus: PaymentStatus.PAID,
          refundStatus: { not: RefundStatus.REFUNDED },
        },
      }),
      prisma.loyaltyTransaction.findMany({
        where: { userId: currentUser.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          orderId: true,
          type: true,
          points: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    const tierInfo = computeMemberTier(currentUser.lifetimePoints);

    const coupons = ACTIVE_COUPONS.filter((c) => c.active).map((coupon) => ({
      code: coupon.code,
      title: coupon.title,
      discountType: coupon.discountType,
      value: coupon.value,
      maxDiscountVND: coupon.maxDiscountVND,
      description: coupon.description,
      memberOnly: Boolean(coupon.memberOnly),
      minOrderVND: coupon.minOrderVND ?? null,
      minTier: coupon.minTier ?? null,
      allowPaidOrderBypass: Boolean(coupon.allowPaidOrderBypass),
      eligibility: evaluateCouponEligibility(coupon, {
        subTotal: coupon.minOrderVND ?? 0,
        isAuthenticated: true,
        memberTier: tierInfo.tier,
        paidOrderCount,
      }),
    }));

    const transactions: LoyaltyTransactionItem[] = rawTransactions.map((tx) => ({
      id: tx.id,
      orderId: tx.orderId,
      type: tx.type as LoyaltyTransactionType,
      points: tx.points,
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    }));

    return NextResponse.json({
      loyaltyPoints: currentUser.loyaltyPoints,
      lifetimePoints: currentUser.lifetimePoints,
      tierInfo,
      paidOrderCount,
      coupons,
      transactions,
    });
  } catch (error) {
    console.error("[GET /api/client/account/loyalty] Error:", error);
    return NextResponse.json(
      { message: "Không thể tải dữ liệu điểm thưởng thành viên." },
      { status: 500 }
    );
  }
}
