export interface CouponDefinition {
  code: string;
  title: string;
  discountType: "fixed" | "percent";
  value: number;
  maxDiscountVND: number;
  description: string;
  active: boolean;
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
] as const;

const COUPON_MAP = new Map<string, CouponDefinition>(
  ACTIVE_COUPONS.map((c) => [c.code, c])
);

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
  if (subTotal <= 0) {
    return { valid: true, normalizedCode: normalized, discount: 0, coupon };
  }
  const rawDiscount =
    coupon.discountType === "fixed"
      ? coupon.value
      : Math.round((subTotal * coupon.value) / 100);
  const discount = Math.min(rawDiscount, coupon.maxDiscountVND, subTotal);
  return { valid: true, normalizedCode: normalized, discount, coupon };
}
