import type { MemberTier } from "@/types/ota";

export interface CouponDefinition {
  code: string;
  title: string;
  discountType: "fixed" | "percent";
  value: number;
  maxDiscountVND: number;
  description: string;
  active: boolean;
  memberOnly?: boolean;
  minOrderVND?: number;
  minTier?: MemberTier;
  allowPaidOrderBypass?: boolean;
}

export const ACTIVE_COUPONS: readonly CouponDefinition[] = [
  {
    code: "TOUR2026",
    title: "Siêu Sale Mùa Hè 2026",
    discountType: "fixed",
    value: 400_000,
    maxDiscountVND: 400_000,
    description: "Giảm trực tiếp tối đa 400.000đ trên tổng giá trị đơn hàng (áp dụng cho mọi tour đang mở bán).",
    active: true,
  },
  {
    code: "TOURMUAHE2024",
    title: "Ưu đãi Mùa Hè",
    discountType: "fixed",
    value: 400_000,
    maxDiscountVND: 400_000,
    description: "Giảm trực tiếp tối đa 400.000đ trên tổng giá trị đơn hàng.",
    active: true,
  },
  {
    code: "GIAM10",
    title: "Giảm 10% Đơn Hàng",
    discountType: "percent",
    value: 10,
    maxDiscountVND: 1_000_000,
    description: "Giảm 10% tổng giá trị đơn hàng, tối đa 1.000.000đ.",
    active: true,
  },
  {
    code: "THANHVIEN200",
    title: "Ưu Đãi Thành Viên 200K",
    discountType: "fixed",
    value: 200_000,
    maxDiscountVND: 200_000,
    description:
      "Dành riêng cho thành viên đăng nhập: giảm trực tiếp 200.000đ cho đơn hàng từ 2.000.000đ.",
    active: true,
    memberOnly: true,
    minOrderVND: 2_000_000,
  },
  {
    code: "VIP500",
    title: "Đặc Quyền Thành Viên Bạc",
    discountType: "fixed",
    value: 500_000,
    maxDiscountVND: 500_000,
    description:
      "Dành cho thành viên hạng Bạc trở lên (hoặc đã có tối thiểu 1 đơn thanh toán): giảm 500.000đ cho đơn hàng từ 8.000.000đ.",
    active: true,
    memberOnly: true,
    minOrderVND: 8_000_000,
    minTier: "SILVER",
    allowPaidOrderBypass: true,
  },
] as const;

const COUPON_MAP = new Map<string, CouponDefinition>(
  ACTIVE_COUPONS.map((c) => [c.code, c])
);

const TIER_RANK: Record<MemberTier, number> = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
};

const TIER_LABELS: Record<MemberTier, string> = {
  BRONZE: "Đồng",
  SILVER: "Bạc",
  GOLD: "Vàng",
};

export interface CouponEligibilityContext {
  subTotal: number;
  isAuthenticated: boolean;
  memberTier?: MemberTier | null;
  paidOrderCount?: number;
}

export interface CouponEligibilityResult {
  eligible: boolean;
  requiresAuth?: boolean;
  reason?: string;
}

export function evaluateCouponEligibility(
  coupon: CouponDefinition,
  ctx: CouponEligibilityContext
): CouponEligibilityResult {
  if (!coupon.active) {
    return {
      eligible: false,
      reason: "Mã giảm giá này hiện không khả dụng.",
    };
  }

  if (coupon.memberOnly && !ctx.isAuthenticated) {
    return {
      eligible: false,
      requiresAuth: true,
      reason: "Đăng nhập để mở khóa mã ưu đãi dành riêng cho thành viên.",
    };
  }

  if (!Number.isFinite(ctx.subTotal) || ctx.subTotal < 0) {
    return {
      eligible: false,
      requiresAuth: false,
      reason: "Giá trị đơn hàng không hợp lệ.",
    };
  }

  if (coupon.minTier) {
    const userRank = TIER_RANK[ctx.memberTier ?? "BRONZE"];
    const requiredRank = TIER_RANK[coupon.minTier];
    const hasPaidBypass = Boolean(
      coupon.allowPaidOrderBypass && (ctx.paidOrderCount ?? 0) >= 1
    );

    if (userRank < requiredRank && !hasPaidBypass) {
      const tierName = TIER_LABELS[coupon.minTier];
      return {
        eligible: false,
        reason: coupon.allowPaidOrderBypass
          ? `Mã này yêu cầu hạng Thành viên ${tierName} hoặc có ít nhất 1 đơn hàng đã thanh toán.`
          : `Mã này yêu cầu hạng Thành viên ${tierName} trở lên.`,
      };
    }
  }

  if (
    typeof coupon.minOrderVND === "number" &&
    coupon.minOrderVND > 0 &&
    ctx.subTotal < coupon.minOrderVND
  ) {
    return {
      eligible: false,
      reason: `Mã ${coupon.code} áp dụng cho đơn hàng từ ${coupon.minOrderVND.toLocaleString("vi-VN")}đ.`,
    };
  }

  return { eligible: true };
}

export function findCouponDefinition(rawCode: string): CouponDefinition | null {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return null;
  return COUPON_MAP.get(normalized) ?? null;
}

export function calculateCouponDiscount(
  rawCode: string,
  subTotal: number
): {
  valid: boolean;
  normalizedCode: string | null;
  discount: number;
  coupon: CouponDefinition | null;
} {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) {
    return { valid: true, normalizedCode: null, discount: 0, coupon: null };
  }
  const coupon = COUPON_MAP.get(normalized);
  if (!coupon || !coupon.active) {
    return { valid: false, normalizedCode: normalized, discount: 0, coupon: null };
  }
  if (!Number.isFinite(subTotal) || subTotal <= 0) {
    return { valid: true, normalizedCode: normalized, discount: 0, coupon };
  }
  const rawDiscount =
    coupon.discountType === "fixed"
      ? coupon.value
      : Math.round((subTotal * coupon.value) / 100);
  const discount = Math.min(rawDiscount, coupon.maxDiscountVND, subTotal);
  return { valid: true, normalizedCode: normalized, discount, coupon };
}
