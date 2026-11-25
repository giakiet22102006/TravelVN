import {
  OrderStatus,
  PaymentStatus,
  RecordStatus,
  RefundStatus,
  type Prisma,
} from "@prisma/client";
import type { MemberTierInfo } from "@/types/ota";

export const WELCOME_BONUS_POINTS = 100;
export const POINT_VALUE_VND = 1_000;
export const SILVER_TIER_MIN_POINTS = 500;
export const GOLD_TIER_MIN_POINTS = 1_500;
const MAX_PG_INT32 = 2_147_483_647;

export class InsufficientPointsError extends Error {
  readonly code = "INSUFFICIENT_POINTS" as const;
  readonly status = 409 as const;

  constructor(message = "Số dư điểm thưởng không đủ để quy đổi cho đơn hàng.") {
    super(message);
    this.name = "InsufficientPointsError";
  }
}

export function computeMemberTier(lifetimePoints: number): MemberTierInfo {
  const pts = Number.isFinite(lifetimePoints)
    ? Math.max(0, Math.floor(lifetimePoints))
    : 0;

  if (pts >= GOLD_TIER_MIN_POINTS) {
    return {
      tier: "GOLD",
      label: "Thành viên Vàng",
      nextTier: null,
      nextTierMinPoints: null,
      progressPercent: 100,
      pointsToNext: 0,
    };
  }

  if (pts >= SILVER_TIER_MIN_POINTS) {
    const span = GOLD_TIER_MIN_POINTS - SILVER_TIER_MIN_POINTS;
    const progressPercent = Math.min(
      99,
      Math.max(0, Math.floor(((pts - SILVER_TIER_MIN_POINTS) / span) * 100))
    );
    return {
      tier: "SILVER",
      label: "Thành viên Bạc",
      nextTier: "GOLD",
      nextTierMinPoints: GOLD_TIER_MIN_POINTS,
      progressPercent,
      pointsToNext: GOLD_TIER_MIN_POINTS - pts,
    };
  }

  const progressPercent = Math.min(
    99,
    Math.max(0, Math.floor((pts / SILVER_TIER_MIN_POINTS) * 100))
  );
  return {
    tier: "BRONZE",
    label: "Thành viên Đồng",
    nextTier: "SILVER",
    nextTierMinPoints: SILVER_TIER_MIN_POINTS,
    progressPercent,
    pointsToNext: SILVER_TIER_MIN_POINTS - pts,
  };
}

/**
 * 1 point = 1.000đ, capped at 20% of post-coupon order subtotal using exact integer math.
 */
export function calculateMaxRedeemablePoints(
  postCouponSubTotal: number,
  availablePoints: number
): number {
  if (!Number.isFinite(postCouponSubTotal) || !Number.isFinite(availablePoints)) {
    return 0;
  }
  const safeAvailable = Math.max(0, Math.floor(availablePoints));
  const maxBySubTotal = Math.floor(Math.max(0, postCouponSubTotal) / 5_000);
  return Math.min(safeAvailable, maxBySubTotal);
}

/**
 * Earn 1% of final order total (1 point per 100.000đ).
 */
export function calculateEarnedPoints(orderTotal: number): number {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
    return 0;
  }
  return Math.floor(orderTotal / 100_000);
}

/**
 * Grants +100 Welcome Bonus points once per user.
 * Locks the User row FOR UPDATE because PostgreSQL @@unique([userId, orderId, type])
 * treats NULL orderId values as distinct.
 */
export async function grantWelcomeBonusTx(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ granted: boolean; points: number }> {
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;

  const existing = await tx.loyaltyTransaction.findFirst({
    where: { userId, type: "WELCOME_BONUS" },
    select: { id: true },
  });

  if (existing) {
    return { granted: false, points: 0 };
  }

  await tx.loyaltyTransaction.create({
    data: {
      userId,
      orderId: null,
      type: "WELCOME_BONUS",
      points: WELCOME_BONUS_POINTS,
      description: "Quà chào mừng thành viên mới (+100 điểm = 100.000đ)",
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: {
      loyaltyPoints: { increment: WELCOME_BONUS_POINTS },
      lifetimePoints: { increment: WELCOME_BONUS_POINTS },
    },
  });

  return { granted: true, points: WELCOME_BONUS_POINTS };
}

/**
 * Atomically deducts loyalty points inside an order-creation transaction.
 * Throws InsufficientPointsError (409) when concurrent requests race for the same balance.
 */
export async function redeemPointsForOrderTx(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    orderId: string;
    orderCode: string;
    pointsToRedeem: number;
  }
): Promise<{ pointsRedeemed: number; pointsDiscount: number }> {
  const pts = Number.isFinite(params.pointsToRedeem)
    ? Math.floor(params.pointsToRedeem)
    : 0;

  if (pts <= 0) {
    return { pointsRedeemed: 0, pointsDiscount: 0 };
  }

  if (pts > MAX_PG_INT32) {
    throw new InsufficientPointsError();
  }

  const updated = await tx.user.updateMany({
    where: {
      id: params.userId,
      deleted: false,
      status: RecordStatus.ACTIVE,
      loyaltyPoints: { gte: pts },
    },
    data: {
      loyaltyPoints: { decrement: pts },
    },
  });

  if (updated.count === 0) {
    throw new InsufficientPointsError();
  }

  const pointsDiscount = pts * POINT_VALUE_VND;

  await tx.loyaltyTransaction.create({
    data: {
      userId: params.userId,
      orderId: params.orderId,
      type: "ORDER_REDEEM",
      points: -pts,
      description: `Quy đổi ${pts.toLocaleString("vi-VN")} điểm giảm giá cho đơn ${params.orderCode}`,
    },
  });

  return { pointsRedeemed: pts, pointsDiscount };
}

/**
 * Idempotently credits 1% earned points when an order has userId != null,
 * status === APPROVED, paymentStatus === PAID, and refundStatus !== REFUNDED.
 * Uses FOR UPDATE + createMany(skipDuplicates: true) to avoid PostgreSQL 25P02 aborted tx.
 */
export async function awardOrderPointsIfEligibleTx(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ awarded: boolean; points: number }> {
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
  `;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      userId: true,
      status: true,
      paymentStatus: true,
      refundStatus: true,
      total: true,
      deleted: true,
    },
  });

  if (
    !order ||
    order.deleted ||
    !order.userId ||
    order.status !== OrderStatus.APPROVED ||
    order.paymentStatus !== PaymentStatus.PAID ||
    order.refundStatus === RefundStatus.REFUNDED
  ) {
    return { awarded: false, points: 0 };
  }

  const pts = calculateEarnedPoints(order.total);
  if (pts <= 0) {
    return { awarded: false, points: 0 };
  }

  const inserted = await tx.loyaltyTransaction.createMany({
    data: [
      {
        userId: order.userId,
        orderId: order.id,
        type: "ORDER_EARN",
        points: pts,
        description: `Tích điểm 1% từ đơn hàng ${order.code}`,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count !== 1) {
    return { awarded: false, points: 0 };
  }

  await tx.user.update({
    where: { id: order.userId },
    data: {
      loyaltyPoints: { increment: pts },
      lifetimePoints: { increment: pts },
    },
  });

  await tx.order.update({
    where: { id: order.id },
    data: { pointsEarned: pts },
  });

  return { awarded: true, points: pts };
}

/**
 * Idempotently refunds pointsRedeemed back to User.loyaltyPoints when an order is cancelled.
 */
export async function refundRedeemedPointsIfAnyTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  reasonLabel?: string
): Promise<{ refunded: boolean; points: number }> {
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
  `;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      userId: true,
      pointsRedeemed: true,
    },
  });

  if (!order || !order.userId || order.pointsRedeemed <= 0) {
    return { refunded: false, points: 0 };
  }

  const description = reasonLabel
    ? `Hoàn ${order.pointsRedeemed.toLocaleString("vi-VN")} điểm từ đơn ${order.code} (${reasonLabel})`
    : `Hoàn ${order.pointsRedeemed.toLocaleString("vi-VN")} điểm do hủy đơn ${order.code}`;

  const inserted = await tx.loyaltyTransaction.createMany({
    data: [
      {
        userId: order.userId,
        orderId: order.id,
        type: "ORDER_REDEEM_REFUND",
        points: order.pointsRedeemed,
        description,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count !== 1) {
    return { refunded: false, points: 0 };
  }

  await tx.user.update({
    where: { id: order.userId },
    data: {
      loyaltyPoints: { increment: order.pointsRedeemed },
    },
  });

  return { refunded: true, points: order.pointsRedeemed };
}

/**
 * Idempotently revokes pointsEarned when a PAID order is marked REFUNDED.
 * Clamps User.loyaltyPoints and User.lifetimePoints at 0 (never negative).
 */
export async function revokeEarnedPointsOnRefundTx(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ revoked: boolean; points: number }> {
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
  `;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      userId: true,
      pointsEarned: true,
    },
  });

  if (!order || !order.userId || order.pointsEarned <= 0) {
    return { revoked: false, points: 0 };
  }

  const inserted = await tx.loyaltyTransaction.createMany({
    data: [
      {
        userId: order.userId,
        orderId: order.id,
        type: "ORDER_REFUND_REVOKE",
        points: -order.pointsEarned,
        description: `Thu hồi ${order.pointsEarned.toLocaleString("vi-VN")} điểm do hoàn tiền đơn ${order.code}`,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count !== 1) {
    return { revoked: false, points: 0 };
  }

  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${order.userId} FOR UPDATE
  `;

  const user = await tx.user.findUnique({
    where: { id: order.userId },
    select: { loyaltyPoints: true, lifetimePoints: true },
  });

  if (user) {
    await tx.user.update({
      where: { id: order.userId },
      data: {
        loyaltyPoints: Math.max(0, user.loyaltyPoints - order.pointsEarned),
        lifetimePoints: Math.max(0, user.lifetimePoints - order.pointsEarned),
      },
    });
  }

  return { revoked: true, points: order.pointsEarned };
}
