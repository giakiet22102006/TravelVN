"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCart } from "@/components/client/CartContext";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import {
  ACTIVE_COUPONS,
  calculateCouponDiscount,
  findCouponDefinition,
} from "@/lib/knowledge/coupons";
import {
  BankTransferInfoBox,
  MomoInfoBox,
} from "@/components/client/BankTransferInfoBox";
import { SmartImage } from "@/components/client/SmartImage";
import { formatCurrencyVND, formatDateVN } from "@/lib/format";

const CART_COUPON_STORAGE_KEY = "travelvn_cart_coupon_v1";

type PaymentMethodType = "CASH" | "MOMO" | "BANK_TRANSFER";

interface CreatedOrderResponse {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  note: string | null;
  subTotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
  paymentMethod: PaymentMethodType;
  items: Array<{
    id: string;
    name: string;
    departureLocation: string;
    quantityAdult: number;
    quantityChild: number;
    quantityBaby: number;
  }>;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  CASH: "Thanh toán tiền mặt khi đi tour",
  MOMO: "Ví MoMo",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
};

function computePreviewDiscount(code: string, subTotal: number): number {
  const res = calculateCouponDiscount(code, subTotal);
  return res.valid ? res.discount : 0;
}

function getCouponSuccessText(code: string): string {
  const coupon = findCouponDefinition(code);
  if (!coupon) return `Áp dụng mã ${code} thành công!`;
  if (coupon.discountType === "fixed") {
    return `Áp dụng mã ${coupon.code} thành công: Giảm ${coupon.maxDiscountVND.toLocaleString("vi-VN")}đ!`;
  }
  return `Áp dụng mã ${coupon.code} thành công: Giảm ${coupon.value}% (tối đa ${coupon.maxDiscountVND.toLocaleString("vi-VN")}đ)!`;
}

export default function CartPage() {
  const {
    items,
    hydrated,
    updateQuantity,
    toggleCheck,
    toggleAll,
    removeItem,
    clearCheckedItems,
    refreshCartFromServer,
    checkedSubTotal,
  } = useCart();
  const { currentUser } = useClientMeta();

  const [syncNotices, setSyncNotices] = useState<string[]>([]);
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (!hydrated || didSyncRef.current) return;
    didSyncRef.current = true;
    if (items.length === 0) return;
    let cancelled = false;
    refreshCartFromServer().then((res) => {
      if (!cancelled && res.notices.length > 0) {
        setSyncNotices(res.notices);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, items.length, refreshCartFromServer]);

  // Coupon state (persisted across reloads)
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponFeedback, setCouponFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [itemQtyHints, setItemQtyHints] = useState<Record<string, string>>({});

  const activeCouponList = useMemo(
    () => ACTIVE_COUPONS.filter((c) => c.active),
    []
  );

  useEffect(() => {
    try {
      const saved = (
        window.localStorage.getItem(CART_COUPON_STORAGE_KEY) || ""
      )
        .trim()
        .toUpperCase();
      const couponDef = findCouponDefinition(saved);
      if (couponDef && couponDef.active) {
        setAppliedCoupon(couponDef.code);
        setCouponInput(couponDef.code);
        setCouponFeedback({
          type: "success",
          text: getCouponSuccessText(couponDef.code),
        });
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Customer Info & Payment state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    setFullName((prev) => prev || currentUser.fullName || "");
    setPhone((prev) => prev || currentUser.phone || "");
  }, [currentUser]);

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    phone?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrderResponse | null>(null);

  const checkedItems = useMemo(
    () => items.filter((item) => item.checked && item.active !== false),
    [items]
  );

  const selectableItems = useMemo(
    () => items.filter((item) => item.active !== false),
    [items]
  );

  const allChecked =
    selectableItems.length > 0 &&
    checkedItems.length === selectableItems.length;

  const discount = useMemo(
    () => computePreviewDiscount(appliedCoupon, checkedSubTotal),
    [appliedCoupon, checkedSubTotal]
  );

  const finalTotal = Math.max(0, checkedSubTotal - discount);

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      clearCoupon();
      return;
    }

    const couponDef = findCouponDefinition(code);
    if (!couponDef || !couponDef.active) {
      setAppliedCoupon("");
      try {
        window.localStorage.removeItem(CART_COUPON_STORAGE_KEY);
      } catch {
        // Ignore
      }
      const suggestedCodes = activeCouponList
        .slice(0, 2)
        .map((c) => c.code)
        .join(" hoặc ");
      setCouponFeedback({
        type: "error",
        text: suggestedCodes
          ? `Mã "${code}" không hợp lệ. Thử dùng ${suggestedCodes}.`
          : `Mã "${code}" không hợp lệ.`,
      });
      return;
    }

    setAppliedCoupon(couponDef.code);
    setCouponInput(couponDef.code);
    try {
      window.localStorage.setItem(CART_COUPON_STORAGE_KEY, couponDef.code);
    } catch {
      // Ignore
    }
    setCouponFeedback({
      type: "success",
      text: getCouponSuccessText(couponDef.code),
    });
  }

  function clearCoupon() {
    setAppliedCoupon("");
    setCouponInput("");
    setCouponFeedback(null);
    try {
      window.localStorage.removeItem(CART_COUPON_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors: { fullName?: string; phone?: string } = {};
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const normalizedPhone = trimmedPhone.replace(/[\s.-]/g, "");

    if (!trimmedName) {
      nextErrors.fullName = "Vui lòng nhập họ và tên khách hàng.";
    } else if (trimmedName.length < 2 || trimmedName.length > 100) {
      nextErrors.fullName = "Họ và tên phải từ 2 đến 100 ký tự.";
    }

    if (!trimmedPhone) {
      nextErrors.phone = "Vui lòng nhập số điện thoại liên hệ.";
    } else if (!/^(\+84|0)[0-9]{8,10}$/.test(normalizedPhone)) {
      nextErrors.phone =
        "Số điện thoại không hợp lệ (ví dụ: 0912345678).";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitError("Vui lòng kiểm tra lại thông tin liên hệ bên trên.");
      const targetEl = nextErrors.fullName
        ? fullNameInputRef.current
        : phoneInputRef.current;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        targetEl.focus({ preventScroll: true });
      }
      return;
    }

    setFieldErrors({});

    if (checkedItems.length === 0) {
      setSubmitError("Vui lòng chọn ít nhất 1 tour trong giỏ hàng để đặt.");
      return;
    }

    const invalidPassengers = checkedItems.some(
      (i) => i.quantityAdult + i.quantityChild + i.quantityBaby <= 0
    );
    if (invalidPassengers) {
      setSubmitError("Mỗi tour được chọn phải có ít nhất 1 hành khách.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/client/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          phone: trimmedPhone,
          note: note.trim() || undefined,
          couponCode: appliedCoupon || undefined,
          paymentMethod,
          items: checkedItems.map((i) => ({
            tourId: i.tourId,
            departureLocation: i.departureLocation,
            quantityAdult: i.quantityAdult,
            quantityChild: i.quantityChild,
            quantityBaby: i.quantityBaby,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(
          data.message || "Không thể tạo đơn hàng, vui lòng thử lại."
        );
        return;
      }

      setCreatedOrder(data.order);
      clearCheckedItems();
      clearCoupon();
    } catch {
      setSubmitError("Không thể kết nối máy chủ, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmation View after successful checkout
  if (createdOrder) {
    return (
      <div className="max-w-[880px] mx-auto px-4 py-10">
        <div className="bg-white rounded-[16px] border border-subtle p-6 sm:p-8 shadow-md">
          <div className="flex flex-col items-center text-center pb-6 border-b border-subtle">
            <div className="w-16 h-16 rounded-full bg-client-soft text-client-primary flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-ink">
              Đặt Tour Thành Công!
            </h1>
            <p className="text-[14px] text-ink-muted mt-1.5">
              Cảm ơn bạn đã tin tưởng VN.TRAVEL. Nhân viên tư vấn sẽ liên hệ xác
              nhận trong ít phút.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-client-soft border border-client-border text-client-primary text-[15px] font-bold tabular-nums">
              <span>Mã đơn hàng:</span>
              <span>{createdOrder.code}</span>
            </div>
          </div>

          <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px] border-b border-subtle">
            <div>
              <span className="text-ink-muted">Khách hàng:</span>{" "}
              <strong className="text-ink">{createdOrder.fullName}</strong>
            </div>
            <div>
              <span className="text-ink-muted">Số điện thoại:</span>{" "}
              <strong className="text-ink tabular-nums">
                {createdOrder.phone}
              </strong>
            </div>
            <div>
              <span className="text-ink-muted">Phương thức thanh toán:</span>{" "}
              <strong className="text-ink">
                {PAYMENT_METHOD_LABELS[createdOrder.paymentMethod]}
              </strong>
            </div>
            <div>
              <span className="text-ink-muted">Tổng thanh toán:</span>{" "}
              <strong className="text-client-accent text-[16px] tabular-nums">
                {formatCurrencyVND(createdOrder.total)}
              </strong>
            </div>
            {createdOrder.note && (
              <div className="sm:col-span-2">
                <span className="text-ink-muted">Ghi chú:</span>{" "}
                <span className="text-ink">{createdOrder.note}</span>
              </div>
            )}
          </div>

          {createdOrder.paymentMethod === "BANK_TRANSFER" && (
            <BankTransferInfoBox orderCode={createdOrder.code} />
          )}
          {createdOrder.paymentMethod === "MOMO" && (
            <MomoInfoBox orderCode={createdOrder.code} />
          )}

          <div className="mt-6 space-y-2.5">
            <p className="text-[14px] font-bold text-ink tabular-nums">
              Danh sách tour đã đặt ({createdOrder.items.length})
            </p>
            {createdOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-page border border-subtle rounded-[10px] p-3.5 text-[13px]"
              >
                <div>
                  <p className="font-bold text-ink">{item.name}</p>
                  <p className="text-ink-muted">
                    Khởi Hành Tại: <strong className="text-ink">{item.departureLocation}</strong>
                  </p>
                </div>
                <div className="text-client-primary font-semibold tabular-nums">
                  NL: {item.quantityAdult} | TE: {item.quantityChild} | EB:{" "}
                  {item.quantityBaby}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {currentUser ? (
              <Link
                href="/account/orders"
                className="px-6 py-2.5 rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[14px] transition-colors"
              >
                Quản lý đơn hàng của tôi
              </Link>
            ) : (
              <Link
                href="/login?next=/account/orders"
                className="px-6 py-2.5 rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[14px] transition-colors"
              >
                Đăng nhập để theo dõi đơn
              </Link>
            )}
            <Link
              href="/tours"
              className="px-6 py-2.5 rounded-[8px] border border-client-primary text-client-primary hover:bg-client-soft font-semibold text-[14px] transition-colors"
            >
              Tiếp tục khám phá Tour
            </Link>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-[8px] border border-strong hover:border-client-primary hover:text-client-primary text-ink font-semibold text-[14px] transition-colors"
            >
              Về Trang Chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showClearCouponBtn = Boolean(appliedCoupon || couponInput);

  return (
    <div className="max-w-[960px] mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Cart Container */}
      <section className="bg-white rounded-[16px] border border-subtle p-5 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-subtle">
          <h1 className="text-[20px] sm:text-[24px] font-bold text-ink">
            Giỏ Hàng
          </h1>
          <Link
            href="/tours"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-client-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại mua hàng</span>
          </Link>
        </div>

        {!hydrated ? (
          <div className="py-12 text-center text-[14px] text-ink-muted">
            Đang tải giỏ hàng...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-ink-muted mb-3" />
            <p className="text-[16px] font-bold text-ink">
              Giỏ hàng của bạn đang trống
            </p>
            <p className="text-[13px] text-ink-muted mt-1">
              Hãy chọn ngay một hành trình du lịch hấp dẫn để bắt đầu đặt tour!
            </p>
            <Link
              href="/tours"
              className="mt-5 inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] bg-client-primary text-white text-[14px] font-semibold hover:bg-client-primary-hover transition-colors"
            >
              Khám Phá Tour Ngay
            </Link>
          </div>
        ) : (
          <>
            {syncNotices.length > 0 && (
              <div
                role="status"
                className="mt-4 rounded-[12px] bg-status-warn-bg border border-status-warn-border p-3.5 text-[12.5px] text-status-warn flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-status-warn" />
                  <ul className="space-y-1">
                    {syncNotices.map((notice, idx) => (
                      <li key={idx}>{notice}</li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  aria-label="Đóng thông báo cập nhật giỏ hàng"
                  onClick={() => setSyncNotices([])}
                  className="p-1 text-status-warn hover:text-ink rounded shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Select All Bar */}
            <div className="py-3 flex items-center justify-between border-b border-subtle text-[13px] tabular-nums">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium text-ink">
                <input
                  type="checkbox"
                  checked={allChecked}
                  disabled={selectableItems.length === 0}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 accent-client-primary rounded"
                />
                <span>Chọn tất cả ({items.length} tour)</span>
              </label>
              <span className="text-ink-muted">
                Đã chọn:{" "}
                <strong className="text-client-primary">
                  {checkedItems.length}
                </strong>
              </span>
            </div>

            {/* Cart Items List */}
            <div className="divide-y divide-subtle">
              {items.map((item) => {
                const isInactive = item.active === false;
                const usedBySameTour = items.reduce(
                  (acc, other) => {
                    if (other.tourId !== item.tourId) return acc;
                    return {
                      adult: acc.adult + other.quantityAdult,
                      child: acc.child + other.quantityChild,
                      baby: acc.baby + other.quantityBaby,
                    };
                  },
                  { adult: 0, child: 0, baby: 0 }
                );

                return (
                <div
                  key={item.cartKey}
                  className={`py-5 flex flex-col lg:flex-row gap-4 lg:items-center justify-between ${
                    isInactive ? "opacity-75" : ""
                  }`}
                >
                  {/* Left: Checkbox + Remove + Thumbnail + Info */}
                  <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-1.5 shrink-0 -ml-2">
                      <label className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.checked && !isInactive}
                          disabled={isInactive}
                          onChange={() => toggleCheck(item.cartKey)}
                          aria-label={`Chọn tour ${item.name}`}
                          className="w-4 h-4 accent-client-primary rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeItem(item.cartKey)}
                        title="Xóa khỏi giỏ"
                        aria-label={`Xóa ${item.name}`}
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <Link
                      href={`/tours/${item.slug}`}
                      className="relative w-[108px] sm:w-[136px] aspect-[16/10] rounded-[8px] overflow-hidden shrink-0 bg-surface-muted"
                    >
                      <SmartImage
                        src={item.avatar}
                        alt={item.name}
                        targetWidth={360}
                        quality={82}
                        priority
                        sizes="150px"
                        className="object-cover"
                      />
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/tours/${item.slug}`}
                        className="text-[15px] font-bold text-ink hover:text-client-primary transition-colors line-clamp-2 leading-snug"
                      >
                        {item.name}
                      </Link>
                      {isInactive && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-status-danger-bg border border-status-danger-border text-status-danger text-[11px] font-semibold">
                          Tour tạm ngừng nhận đặt
                        </span>
                      )}
                      <p className="text-[12px] text-ink-muted">
                        Mã Tour:{" "}
                        <strong className="text-ink tabular-nums">
                          {item.code}
                        </strong>
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        Ngày Khởi Hành:{" "}
                        <strong className="text-ink tabular-nums">
                          {formatDateVN(item.departureDate)}
                        </strong>
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        Khởi Hành Tại:{" "}
                        <strong className="text-ink">
                          {item.departureLocation}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* Right: Quantities */}
                  <div className="lg:w-[340px] shrink-0 space-y-2.5 pl-0">
                    <p className="text-[12px] font-semibold text-ink-muted">
                      Số Lượng Hành Khách
                    </p>

                    {[
                      {
                        name: "Người lớn",
                        label: "Người lớn:",
                        tier: "adult" as const,
                        qty: item.quantityAdult,
                        minQty: item.stockAdult > 0 ? 1 : 0,
                        totalUsed: usedBySameTour.adult,
                        stock: item.stockAdult,
                        price: item.priceNewAdult,
                      },
                      {
                        name: "Trẻ em",
                        label: "Trẻ em:",
                        tier: "child" as const,
                        qty: item.quantityChild,
                        minQty: 0,
                        totalUsed: usedBySameTour.child,
                        stock: item.stockChild,
                        price: item.priceNewChild,
                      },
                      {
                        name: "Em bé",
                        label: "Em bé:",
                        tier: "baby" as const,
                        qty: item.quantityBaby,
                        minQty: 0,
                        totalUsed: usedBySameTour.baby,
                        stock: item.stockBaby,
                        price: item.priceNewBaby,
                      },
                    ].map((row) => {
                      const atMin = isInactive || row.qty <= row.minQty;
                      const atMax = isInactive || row.totalUsed >= row.stock;
                      return (
                      <div
                        key={row.tier}
                        className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-ink w-[78px] shrink-0">
                          {row.label}
                        </span>

                        <div className="flex items-center border border-strong rounded-[8px] overflow-hidden shrink-0">
                          <button
                            type="button"
                            aria-label={`Giảm số lượng ${row.name}`}
                            aria-disabled={atMin}
                            onClick={() => {
                              if (isInactive) return;
                              if (atMin) {
                                if (row.tier === "adult") {
                                  setItemQtyHints((prev) => ({
                                    ...prev,
                                    [item.cartKey]:
                                      "Tối thiểu 1 Người lớn — bấm biểu tượng thùng rác nếu muốn xóa tour.",
                                  }));
                                }
                                return;
                              }
                              setItemQtyHints((prev) => {
                                const next = { ...prev };
                                delete next[item.cartKey];
                                return next;
                              });
                              updateQuantity(
                                item.cartKey,
                                row.tier,
                                row.qty - 1
                              );
                            }}
                            className={`w-10 h-10 shrink-0 sm:w-9 sm:h-9 flex items-center justify-center transition-colors ${
                              atMin
                                ? "text-ink-muted opacity-50 cursor-not-allowed bg-surface-page"
                                : "hover:bg-surface-muted text-ink"
                            }`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-[13px] font-bold text-ink tabular-nums shrink-0">
                            {row.qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tăng số lượng ${row.name}`}
                            aria-disabled={atMax}
                            onClick={() => {
                              if (isInactive) return;
                              if (atMax) {
                                setItemQtyHints((prev) => ({
                                  ...prev,
                                  [item.cartKey]: `Chỉ còn tối đa ${row.stock} chỗ cho hạng vé ${row.name}.`,
                                }));
                                return;
                              }
                              setItemQtyHints((prev) => {
                                const next = { ...prev };
                                delete next[item.cartKey];
                                return next;
                              });
                              updateQuantity(
                                item.cartKey,
                                row.tier,
                                row.qty + 1
                              );
                            }}
                            className={`w-10 h-10 shrink-0 sm:w-9 sm:h-9 flex items-center justify-center transition-colors ${
                              atMax
                                ? "text-ink-muted opacity-40 cursor-not-allowed bg-surface-page"
                                : "hover:bg-surface-muted text-ink"
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="min-w-[92px] text-right font-semibold text-ink-muted text-[12px] tabular-nums shrink-0">
                          {row.qty} x{" "}
                          <span className="text-client-accent font-bold">
                            {row.price.toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>
                      );
                    })}

                    {itemQtyHints[item.cartKey] && (
                      <p
                        role="status"
                        className="text-[11.5px] text-status-warn bg-status-warn-bg border border-status-warn-border rounded-[8px] px-2.5 py-1.5 font-medium"
                      >
                        {itemQtyHints[item.cartKey]}
                      </p>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Coupon & Summary Row */}
            <div className="pt-5 border-t border-subtle flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="md:max-w-[440px] w-full">
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Tag className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      aria-label="Mã giảm giá"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder={
                        activeCouponList[0]
                          ? `Nhập mã (vd: ${activeCouponList[0].code})`
                          : "Nhập mã giảm giá"
                      }
                      className={`w-full h-[42px] pl-9 rounded-[8px] border border-strong text-[13px] text-ink uppercase placeholder:normal-case placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
                        showClearCouponBtn ? "pr-10" : "pr-3"
                      }`}
                    />
                    {showClearCouponBtn && (
                      <button
                        type="button"
                        onClick={clearCoupon}
                        title="Xóa mã giảm giá"
                        aria-label="Xóa mã giảm giá"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-status-danger transition-colors rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-4 h-[42px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 shrink-0"
                  >
                    Dùng Mã
                  </button>
                </form>

                {couponFeedback && (
                  <p
                    className={`mt-2 text-[12px] font-medium tabular-nums ${
                      couponFeedback.type === "success"
                        ? "text-client-primary"
                        : "text-status-danger"
                    }`}
                  >
                    {couponFeedback.text}
                  </p>
                )}
              </div>

              <div className="md:min-w-[300px] space-y-2 text-[14px] tabular-nums">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-muted">Tổng tiền:</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatCurrencyVND(checkedSubTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-muted">Giảm:</span>
                  <span className="font-semibold text-client-accent tabular-nums">
                    -{formatCurrencyVND(discount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-subtle flex items-center justify-between gap-4">
                  <span className="font-bold text-ink">Thanh toán:</span>
                  <span className="text-[22px] font-extrabold text-client-accent tabular-nums">
                    {formatCurrencyVND(finalTotal)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Customer Info & Payment Section */}
      {hydrated && items.length > 0 && (
        <form
          noValidate
          onSubmit={handleCheckoutSubmit}
          className="bg-white rounded-[16px] border border-subtle p-5 sm:p-7 shadow-sm space-y-6"
        >
          {/* Thông Tin Khách Hàng */}
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-ink mb-4">
              Thông Tin Khách Hàng
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-fullName"
                  className="block text-[13px] font-medium text-ink mb-1.5"
                >
                  Họ và tên <span className="text-status-danger">*</span>
                </label>
                <input
                  ref={fullNameInputRef}
                  id="checkout-fullName"
                  type="text"
                  required
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                    }
                  }}
                  placeholder="Ví dụ: Nguyễn Minh An"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={`scroll-mt-32 w-full h-[44px] px-3.5 rounded-[8px] border text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
                    fieldErrors.fullName
                      ? "border-status-danger bg-status-danger-bg/40"
                      : "border-strong"
                  }`}
                />
                {fieldErrors.fullName && (
                  <p
                    role="alert"
                    className="mt-1.5 text-[12px] text-status-danger font-medium"
                  >
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-phone"
                  className="block text-[13px] font-medium text-ink mb-1.5"
                >
                  Số điện thoại <span className="text-status-danger">*</span>
                </label>
                <input
                  ref={phoneInputRef}
                  id="checkout-phone"
                  type="tel"
                  required
                  maxLength={15}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) {
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  placeholder="Ví dụ: 0912345678"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={`scroll-mt-32 w-full h-[44px] px-3.5 rounded-[8px] border text-[14px] text-ink tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
                    fieldErrors.phone
                      ? "border-status-danger bg-status-danger-bg/40"
                      : "border-strong"
                  }`}
                />
                {fieldErrors.phone && (
                  <p
                    role="alert"
                    className="mt-1.5 text-[12px] text-status-danger font-medium"
                  >
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-note"
                  className="block text-[13px] font-medium text-ink mb-1.5"
                >
                  Ghi chú
                </label>
                <textarea
                  id="checkout-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Yêu cầu đặc biệt (phòng view biển, ăn chay, xuất hóa đơn VAT...)"
                  className="w-full p-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
            </div>
          </div>

          {/* CHỌN phương thức thanh toán */}
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-ink mb-3.5 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-client-primary" />
              <span>Chọn phương thức thanh toán</span>
            </h2>

            <div className="space-y-2.5 text-[14px]">
              {(["CASH", "MOMO", "BANK_TRANSFER"] as PaymentMethodType[]).map(
                (method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors ${
                      paymentMethod === method
                        ? "border-client-border bg-client-soft font-semibold text-client-primary"
                        : "border-subtle hover:border-strong text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="w-4 h-4 accent-client-primary"
                    />
                    <span>{PAYMENT_METHOD_LABELS[method]}</span>
                  </label>
                )
              )}
            </div>

            {paymentMethod === "BANK_TRANSFER" && <BankTransferInfoBox />}
            {paymentMethod === "MOMO" && <MomoInfoBox />}
          </div>

          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-[8px] bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] font-medium"
            >
              {submitError}
            </div>
          )}

          <div className="text-center pt-2">
            <button
              type="submit"
              disabled={submitting || checkedItems.length === 0}
              className="w-full sm:w-[320px] h-[48px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover disabled:opacity-50 text-white font-bold text-[15px] tracking-wide transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
            >
              {submitting ? "Đang xử lý đơn hàng..." : "Đặt Tour"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
