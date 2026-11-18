"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
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
import { BankTransferInfoBox } from "@/components/client/BankTransferInfoBox";
import { SmartImage } from "@/components/client/SmartImage";
import { formatCurrencyVND, formatDateVN } from "@/lib/format";

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
  const normalized = code.trim().toUpperCase();
  if (!normalized || subTotal <= 0) return 0;
  if (normalized === "TOURMUAHE2024") return Math.min(400000, subTotal);
  if (normalized === "GIAM10") {
    return Math.min(Math.round(subTotal * 0.1), 1000000, subTotal);
  }
  return 0;
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
    checkedSubTotal,
  } = useCart();
  const { currentUser } = useClientMeta();

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponFeedback, setCouponFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Customer Info & Payment state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");

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
    () => items.filter((item) => item.checked),
    [items]
  );

  const allChecked = items.length > 0 && checkedItems.length === items.length;

  const discount = useMemo(
    () => computePreviewDiscount(appliedCoupon, checkedSubTotal),
    [appliedCoupon, checkedSubTotal]
  );

  const finalTotal = Math.max(0, checkedSubTotal - discount);

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon("");
      setCouponFeedback(null);
      return;
    }

    if (code !== "TOURMUAHE2024" && code !== "GIAM10") {
      setAppliedCoupon("");
      setCouponFeedback({
        type: "error",
        text: `Mã "${code}" không hợp lệ. Thử dùng TOURMUAHE2024 hoặc GIAM10.`,
      });
      return;
    }

    setAppliedCoupon(code);
    setCouponInput(code);
    setCouponFeedback({
      type: "success",
      text:
        code === "TOURMUAHE2024"
          ? "Áp dụng mã TOURMUAHE2024 thành công: Giảm 400.000đ!"
          : "Áp dụng mã GIAM10 thành công: Giảm 10% (tối đa 1.000.000đ)!",
    });
  }

  function clearCoupon() {
    setAppliedCoupon("");
    setCouponInput("");
    setCouponFeedback(null);
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
        <div className="bg-white rounded-[16px] border border-[#ECECEC] p-6 sm:p-8 shadow-md">
          <div className="flex flex-col items-center text-center pb-6 border-b border-[#ECECEC]">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-[#4502C7]">
              Đặt Tour Thành Công!
            </h1>
            <p className="text-[14px] text-[#667479] mt-1.5">
              Cảm ơn bạn đã tin tưởng VN.TRAVEL. Nhân viên tư vấn sẽ liên hệ xác
              nhận trong ít phút.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4502C7]/10 text-[#4502C7] text-[15px] font-bold">
              <span>Mã đơn hàng:</span>
              <span>{createdOrder.code}</span>
            </div>
          </div>

          <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px] border-b border-[#ECECEC]">
            <div>
              <span className="text-[#667479]">Khách hàng:</span>{" "}
              <strong className="text-[#25282B]">{createdOrder.fullName}</strong>
            </div>
            <div>
              <span className="text-[#667479]">Số điện thoại:</span>{" "}
              <strong className="text-[#25282B]">{createdOrder.phone}</strong>
            </div>
            <div>
              <span className="text-[#667479]">Phương thức thanh toán:</span>{" "}
              <strong className="text-[#25282B]">
                {PAYMENT_METHOD_LABELS[createdOrder.paymentMethod]}
              </strong>
            </div>
            <div>
              <span className="text-[#667479]">Tổng thanh toán:</span>{" "}
              <strong className="text-[#DA0808] text-[16px]">
                {formatCurrencyVND(createdOrder.total)}
              </strong>
            </div>
            {createdOrder.note && (
              <div className="sm:col-span-2">
                <span className="text-[#667479]">Ghi chú:</span>{" "}
                <span className="text-[#25282B]">{createdOrder.note}</span>
              </div>
            )}
          </div>

          {createdOrder.paymentMethod === "BANK_TRANSFER" && (
            <BankTransferInfoBox orderCode={createdOrder.code} />
          )}

          <div className="mt-6 space-y-2.5">
            <p className="text-[14px] font-bold text-[#25282B]">
              Danh sách tour đã đặt ({createdOrder.items.length})
            </p>
            {createdOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F6F6F6] rounded-[10px] p-3.5 text-[13px]"
              >
                <div>
                  <p className="font-bold text-[#25282B]">{item.name}</p>
                  <p className="text-[#667479]">
                    Khởi Hành Tại: <strong>{item.departureLocation}</strong>
                  </p>
                </div>
                <div className="text-[#4502C7] font-semibold">
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
                className="px-6 py-2.5 rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white font-semibold text-[14px]"
              >
                Quản lý đơn hàng của tôi
              </Link>
            ) : (
              <Link
                href="/login?next=/account/orders"
                className="px-6 py-2.5 rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white font-semibold text-[14px]"
              >
                Đăng nhập để theo dõi đơn
              </Link>
            )}
            <Link
              href="/tours"
              className="px-6 py-2.5 rounded-[8px] border border-[#4502C7] text-[#4502C7] hover:bg-[#4502C7]/5 font-semibold text-[14px]"
            >
              Tiếp tục khám phá Tour
            </Link>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-[8px] border border-[#CCD1D2] hover:border-[#4502C7] text-[#25282B] font-semibold text-[14px]"
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
      <section className="bg-white rounded-[16px] border border-[#ECECEC] p-5 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ECECEC]">
          <h1 className="text-[20px] sm:text-[24px] font-bold text-[#4502C7]">
            Giỏ Hàng
          </h1>
          <Link
            href="/tours"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#4502C7] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại mua hàng</span>
          </Link>
        </div>

        {!hydrated ? (
          <div className="py-12 text-center text-[14px] text-[#667479]">
            Đang tải giỏ hàng...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-[#99A2A5] mb-3" />
            <p className="text-[16px] font-bold text-[#25282B]">
              Giỏ hàng của bạn đang trống
            </p>
            <p className="text-[13px] text-[#667479] mt-1">
              Hãy chọn ngay một hành trình du lịch hấp dẫn để bắt đầu đặt tour!
            </p>
            <Link
              href="/tours"
              className="mt-5 inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] bg-[#4502C7] text-white text-[14px] font-semibold hover:bg-[#36019e]"
            >
              Khám Phá Tour Ngay
            </Link>
          </div>
        ) : (
          <>
            {/* Select All Bar */}
            <div className="py-3 flex items-center justify-between border-b border-[#ECECEC] text-[13px]">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium text-[#25282B]">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 accent-[#4502C7] rounded"
                />
                <span>Chọn tất cả ({items.length} tour)</span>
              </label>
              <span className="text-[#667479]">
                Đã chọn:{" "}
                <strong className="text-[#4502C7]">{checkedItems.length}</strong>
              </span>
            </div>

            {/* Cart Items List */}
            <div className="divide-y divide-[#ECECEC]">
              {items.map((item) => {
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
                  className="py-5 flex flex-col md:flex-row gap-4 md:items-center justify-between"
                >
                  {/* Left: Checkbox + Remove + Thumbnail + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleCheck(item.cartKey)}
                        aria-label={`Chọn tour ${item.name}`}
                        className="w-4 h-4 accent-[#4502C7] rounded cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.cartKey)}
                        title="Xóa khỏi giỏ"
                        aria-label={`Xóa ${item.name}`}
                        className="text-[#99A2A5] hover:text-[#DA0808] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <Link
                      href={`/tours/${item.slug}`}
                      className="relative w-[105px] sm:w-[135px] aspect-[16/10] rounded-[8px] overflow-hidden shrink-0 bg-[#F6F6F6]"
                    >
                      <SmartImage
                        src={item.avatar}
                        alt={item.name}
                        targetWidth={360}
                        quality={82}
                        sizes="150px"
                        className="object-cover"
                      />
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/tours/${item.slug}`}
                        className="text-[15px] font-bold text-[#25282B] hover:text-[#4502C7] line-clamp-2 leading-snug"
                      >
                        {item.name}
                      </Link>
                      <p className="text-[12px] text-[#667479]">
                        Mã Tour:{" "}
                        <strong className="text-[#25282B]">{item.code}</strong>
                      </p>
                      <p className="text-[12px] text-[#667479]">
                        Ngày Khởi Hành:{" "}
                        <strong className="text-[#25282B]">
                          {formatDateVN(item.departureDate)}
                        </strong>
                      </p>
                      <p className="text-[12px] text-[#667479]">
                        Khởi Hành Tại:{" "}
                        <strong className="text-[#25282B]">
                          {item.departureLocation}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* Right: Quantities */}
                  <div className="md:w-[320px] shrink-0 space-y-2 pl-7 md:pl-0">
                    <p className="text-[12px] font-semibold text-[#667479]">
                      Số Lượng Hành Khách
                    </p>

                    {[
                      {
                        name: "Người lớn",
                        label: "Người lớn:",
                        tier: "adult" as const,
                        qty: item.quantityAdult,
                        totalUsed: usedBySameTour.adult,
                        stock: item.stockAdult,
                        price: item.priceNewAdult,
                      },
                      {
                        name: "Trẻ em",
                        label: "Trẻ em:",
                        tier: "child" as const,
                        qty: item.quantityChild,
                        totalUsed: usedBySameTour.child,
                        stock: item.stockChild,
                        price: item.priceNewChild,
                      },
                      {
                        name: "Em bé",
                        label: "Em bé:",
                        tier: "baby" as const,
                        qty: item.quantityBaby,
                        totalUsed: usedBySameTour.baby,
                        stock: item.stockBaby,
                        price: item.priceNewBaby,
                      },
                    ].map((row) => (
                      <div
                        key={row.tier}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-[#25282B] w-[76px]">
                          {row.label}
                        </span>

                        <div className="flex items-center border border-[#CCD1D2] rounded-[6px] overflow-hidden">
                          <button
                            type="button"
                            aria-label={`Giảm số lượng ${row.name}`}
                            onClick={() =>
                              updateQuantity(
                                item.cartKey,
                                row.tier,
                                row.qty - 1
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center hover:bg-[#F6F6F6]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-[12px] font-bold">
                            {row.qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tăng số lượng ${row.name}`}
                            disabled={row.totalUsed >= row.stock}
                            onClick={() =>
                              updateQuantity(
                                item.cartKey,
                                row.tier,
                                row.qty + 1
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center hover:bg-[#F6F6F6] disabled:opacity-40"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="min-w-[96px] text-right font-semibold text-[#4502C7] text-[12px]">
                          {row.qty} x{" "}
                          <span className="text-[#DA0808]">
                            {row.price.toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Coupon & Summary Row */}
            <div className="pt-5 border-t border-[#ECECEC] flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="md:max-w-[440px] w-full">
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Tag className="w-4 h-4 text-[#99A2A5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      aria-label="Mã giảm giá"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Nhập mã ưu đãi (vd: GIAM10)"
                      className={`w-full h-[42px] pl-9 rounded-[8px] border border-[#CCD1D2] text-[13px] uppercase placeholder:normal-case focus:outline-none focus:border-[#4502C7] ${
                        showClearCouponBtn ? "pr-10" : "pr-3"
                      }`}
                    />
                    {showClearCouponBtn && (
                      <button
                        type="button"
                        onClick={clearCoupon}
                        title="Xóa mã giảm giá"
                        aria-label="Xóa mã giảm giá"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#667479] hover:text-[#DA0808] rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-4 h-[42px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0"
                  >
                    Dùng Mã
                  </button>
                </form>

                {couponFeedback && (
                  <p
                    className={`mt-2 text-[12px] ${
                      couponFeedback.type === "success"
                        ? "text-emerald-600 font-medium"
                        : "text-[#DA0808]"
                    }`}
                  >
                    {couponFeedback.text}
                  </p>
                )}
              </div>

              <div className="md:min-w-[300px] space-y-2 text-[14px]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#667479]">Tổng tiền:</span>
                  <span className="font-semibold text-[#25282B]">
                    {formatCurrencyVND(checkedSubTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#667479]">Giảm:</span>
                  <span className="font-semibold text-[#DA0808]">
                    -{formatCurrencyVND(discount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#ECECEC] flex items-center justify-between gap-4">
                  <span className="font-bold text-[#25282B]">Thanh toán:</span>
                  <span className="text-[22px] font-extrabold text-[#4502C7]">
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
          className="bg-white rounded-[16px] border border-[#ECECEC] p-5 sm:p-7 shadow-sm space-y-6"
        >
          {/* Thông Tin Khách Hàng */}
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-[#4502C7] mb-4">
              Thông Tin Khách Hàng
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-fullName"
                  className="block text-[13px] font-medium text-[#25282B] mb-1.5"
                >
                  Họ và tên <span className="text-[#DA0808]">*</span>
                </label>
                <input
                  id="checkout-fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                    }
                  }}
                  placeholder="Ví dụ: Nguyễn Minh An"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={`w-full h-[44px] px-3.5 rounded-[8px] border text-[14px] focus:outline-none focus:border-[#4502C7] ${
                    fieldErrors.fullName
                      ? "border-[#DA0808] bg-red-50/40"
                      : "border-[#CCD1D2]"
                  }`}
                />
                {fieldErrors.fullName && (
                  <p
                    role="alert"
                    className="mt-1.5 text-[12px] text-[#DA0808] font-medium"
                  >
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-phone"
                  className="block text-[13px] font-medium text-[#25282B] mb-1.5"
                >
                  Số điện thoại <span className="text-[#DA0808]">*</span>
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) {
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  placeholder="Ví dụ: 0912345678"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={`w-full h-[44px] px-3.5 rounded-[8px] border text-[14px] focus:outline-none focus:border-[#4502C7] ${
                    fieldErrors.phone
                      ? "border-[#DA0808] bg-red-50/40"
                      : "border-[#CCD1D2]"
                  }`}
                />
                {fieldErrors.phone && (
                  <p
                    role="alert"
                    className="mt-1.5 text-[12px] text-[#DA0808] font-medium"
                  >
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-note"
                  className="block text-[13px] font-medium text-[#25282B] mb-1.5"
                >
                  Ghi chú
                </label>
                <textarea
                  id="checkout-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Yêu cầu đặc biệt (phòng view biển, ăn chay, xuất hóa đơn VAT...)"
                  className="w-full p-3.5 rounded-[8px] border border-[#CCD1D2] text-[14px] focus:outline-none focus:border-[#4502C7]"
                />
              </div>
            </div>
          </div>

          {/* CHỌN phương thức thanh toán */}
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-[#4502C7] mb-3.5 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <span>Chọn phương thức thanh toán</span>
            </h2>

            <div className="space-y-2.5 text-[14px]">
              {(["CASH", "MOMO", "BANK_TRANSFER"] as PaymentMethodType[]).map(
                (method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors ${
                      paymentMethod === method
                        ? "border-[#4502C7] bg-[#4502C7]/5 font-semibold text-[#4502C7]"
                        : "border-[#ECECEC] hover:border-[#CCD1D2] text-[#25282B]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="w-4 h-4 accent-[#4502C7]"
                    />
                    <span>{PAYMENT_METHOD_LABELS[method]}</span>
                  </label>
                )
              )}
            </div>

            {paymentMethod === "BANK_TRANSFER" && <BankTransferInfoBox />}
          </div>

          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-[8px] bg-red-50 border border-red-200 text-[#DA0808] text-[13px] font-medium"
            >
              {submitError}
            </div>
          )}

          <div className="text-center pt-2">
            <button
              type="submit"
              disabled={submitting || checkedItems.length === 0}
              className="w-full sm:w-[320px] h-[48px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] disabled:opacity-50 text-white font-bold text-[15px] tracking-wide transition-colors shadow-md"
            >
              {submitting ? "Đang xử lý đơn hàng..." : "Đặt Tour"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
