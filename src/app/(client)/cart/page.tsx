"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Minus,
  Plane,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  Users,
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
import type { OrderPassengerInput } from "@/types/ota";

const CART_COUPON_STORAGE_KEY = "travelvn_cart_coupon_v1";

type PaymentMethodType = "CASH" | "MOMO" | "BANK_TRANSFER";
type CheckoutStep = 1 | 2 | 3;

interface CreatedOrderItem {
  id: string;
  name: string;
  departureCode?: string | null;
  airline?: string | null;
  flightOut?: string | null;
  flightBack?: string | null;
  departureLocation: string;
  departureDate?: string | null;
  quantityAdult: number;
  quantityChild: number;
  quantityBaby: number;
  singleRoomCount?: number;
  singleRoomSurcharge?: number;
}

interface CreatedOrderResponse {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email?: string | null;
  note: string | null;
  subTotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
  paymentMethod: PaymentMethodType;
  paymentStatus: "UNPAID" | "PAID";
  refundStatus: "NONE" | "REFUND_REQUIRED" | "REFUNDED";
  status: "INITIAL" | "APPROVED" | "CANCELLED";
  expiresAt?: string | null;
  paidAt?: string | null;
  items: CreatedOrderItem[];
}

interface PassengerSlotMeta {
  key: string;
  tourName: string;
  tier: OrderPassengerInput["tier"];
  tierLabel: string;
  slotIndex: number;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  CASH: "Thanh toán tiền mặt khi đi tour",
  MOMO: "Ví MoMo",
  BANK_TRANSFER: "Chuyển khoản ngân hàng (VietQR)",
};

const TIER_LABELS: Record<OrderPassengerInput["tier"], string> = {
  ADULT: "Người lớn",
  CHILD: "Trẻ em",
  BABY: "Em bé",
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

function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const STEPS: Array<{ step: CheckoutStep; label: string }> = [
  { step: 1, label: "Giỏ hàng & Dịch vụ" },
  { step: 2, label: "Hành khách & Liên hệ" },
  { step: 3, label: "Thanh toán & Xác nhận" },
];

export default function CartPage() {
  const {
    items,
    hydrated,
    updateQuantity,
    updateSingleRoomCount,
    toggleCheck,
    toggleAll,
    removeItem,
    clearCheckedItems,
    refreshCartFromServer,
    checkedSubTotal,
  } = useCart();
  const { currentUser } = useClientMeta();

  const [step, setStep] = useState<CheckoutStep>(1);
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

  // Coupon state
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

  // Contact & Payment state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>("BANK_TRANSFER");
  const [agreedTerms, setAgreedTerms] = useState(false);

  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    setFullName((prev) => prev || currentUser.fullName || "");
    setPhone((prev) => prev || currentUser.phone || "");
    setEmail((prev) => prev || currentUser.email || "");
  }, [currentUser]);

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    phone?: string;
    email?: string;
    passengers?: string;
    agreedTerms?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Confirmation & Live Polling state
  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrderResponse | null>(null);
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [simulatingSandbox, setSimulatingSandbox] = useState(false);
  const [sandboxNotice, setSandboxNotice] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState<number>(0);

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

  // Build passenger slots matching checkedItems
  const passengerSlots = useMemo<PassengerSlotMeta[]>(() => {
    const slots: PassengerSlotMeta[] = [];
    let runningIndex = 0;
    for (const item of checkedItems) {
      const tiers: Array<{
        tier: OrderPassengerInput["tier"];
        count: number;
      }> = [
        { tier: "ADULT", count: item.quantityAdult },
        { tier: "CHILD", count: item.quantityChild },
        { tier: "BABY", count: item.quantityBaby },
      ];
      for (const t of tiers) {
        for (let i = 0; i < t.count; i++) {
          slots.push({
            key: `${item.cartKey}-${t.tier}-${i}`,
            tourName: item.name,
            tier: t.tier,
            tierLabel: `${TIER_LABELS[t.tier]} ${i + 1}`,
            slotIndex: runningIndex++,
          });
        }
      }
    }
    return slots;
  }, [checkedItems]);

  const [passengers, setPassengers] = useState<OrderPassengerInput[]>([]);

  useEffect(() => {
    setPassengers((prev) =>
      passengerSlots.map((slot, idx) => {
        const existing = prev[idx];
        return {
          fullName: existing?.fullName || "",
          gender: existing?.gender || "MALE",
          birthDate: existing?.birthDate || "",
          tier: slot.tier,
          documentNumber: existing?.documentNumber || "",
        };
      })
    );
  }, [passengerSlots]);

  function updatePassengerField(
    index: number,
    field: keyof OrderPassengerInput,
    value: string
  ) {
    setPassengers((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, [field]: value } : p))
    );
    if (fieldErrors.passengers) {
      setFieldErrors((prev) => ({ ...prev, passengers: undefined }));
    }
  }

  function quickFillFirstPassenger() {
    const trimmed = fullName.trim();
    if (!trimmed || passengers.length === 0) return;
    setPassengers((prev) =>
      prev.map((p, idx) => (idx === 0 ? { ...p, fullName: trimmed } : p))
    );
    if (fieldErrors.passengers) {
      setFieldErrors((prev) => ({ ...prev, passengers: undefined }));
    }
  }

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

  function handleProceedToStep2() {
    setSubmitError(null);
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
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateStep2(): boolean {
    const nextErrors: typeof fieldErrors = {};
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const normalizedPhone = trimmedPhone.replace(/[\s.-]/g, "");

    if (!trimmedName) {
      nextErrors.fullName = "Vui lòng nhập họ và tên người đặt.";
    } else if (trimmedName.length < 2 || trimmedName.length > 100) {
      nextErrors.fullName = "Họ và tên phải từ 2 đến 100 ký tự.";
    }

    if (!trimmedPhone) {
      nextErrors.phone = "Vui lòng nhập số điện thoại liên hệ.";
    } else if (!/^(\+84|0)[0-9]{8,10}$/.test(normalizedPhone)) {
      nextErrors.phone = "Số điện thoại không hợp lệ (ví dụ: 0912345678).";
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email =
        "Vui lòng nhập email hợp lệ để nhận e-Voucher và hóa đơn.";
    }

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.fullName.trim() || p.fullName.trim().length < 2) {
        nextErrors.passengers = `Vui lòng nhập đầy đủ họ tên cho Hành khách ${i + 1}.`;
        break;
      }
      if (!p.birthDate) {
        nextErrors.passengers = `Vui lòng chọn ngày sinh cho Hành khách ${i + 1}.`;
        break;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitError("Vui lòng kiểm tra lại thông tin liên hệ và hành khách.");
      const targetEl = nextErrors.fullName
        ? fullNameInputRef.current
        : nextErrors.phone
          ? phoneInputRef.current
          : nextErrors.email
            ? emailInputRef.current
            : null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        targetEl.focus({ preventScroll: true });
      }
      return false;
    }

    setFieldErrors({});
    setSubmitError(null);
    return true;
  }

  function handleProceedToStep3() {
    if (validateStep2()) {
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validateStep2()) {
      setStep(2);
      return;
    }

    if (!agreedTerms) {
      setFieldErrors((prev) => ({
        ...prev,
        agreedTerms:
          "Vui lòng đồng ý với Điều khoản đặt tour và Chính sách hoàn hủy.",
      }));
      setSubmitError(
        "Vui lòng xác nhận đồng ý với Điều khoản đặt tour trước khi hoàn tất."
      );
      return;
    }

    if (checkedItems.length === 0) {
      setSubmitError("Vui lòng chọn ít nhất 1 tour trong giỏ hàng để đặt.");
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/client/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          agreedTerms: true,
          note: note.trim() || undefined,
          couponCode: appliedCoupon || undefined,
          paymentMethod,
          passengers: passengers.map((p, idx) => ({
            fullName: p.fullName.trim(),
            gender: p.gender,
            birthDate: p.birthDate,
            tier: passengerSlots[idx]?.tier || p.tier,
            documentNumber: p.documentNumber?.trim() || undefined,
          })),
          items: checkedItems.map((i) => ({
            tourId: i.tourId,
            departureId: i.departureId || undefined,
            departureLocation: i.departureLocation,
            quantityAdult: i.quantityAdult,
            quantityChild: i.quantityChild,
            quantityBaby: i.quantityBaby,
            singleRoomCount: i.singleRoomCount || 0,
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Không thể kết nối máy chủ, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const pollOrderStatus = useCallback(async (order: CreatedOrderResponse) => {
    try {
      const qs = `?phone=${encodeURIComponent(order.phone)}`;
      const res = await fetch(
        `/api/client/orders/${encodeURIComponent(order.code)}/status${qs}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.sandboxEnabled === "boolean") {
        setSandboxEnabled(data.sandboxEnabled);
      }
      if (data.order) {
        setCreatedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: data.order.status,
                paymentStatus: data.order.paymentStatus,
                refundStatus: data.order.refundStatus,
                expiresAt: data.order.expiresAt,
                paidAt: data.order.paidAt,
              }
            : prev
        );
      }
    } catch {
      // Ignore transient poll errors
    }
  }, []);

  // Poll status every 3s while awaiting online payment
  useEffect(() => {
    if (!createdOrder) return;
    pollOrderStatus(createdOrder);

    if (
      createdOrder.status !== "INITIAL" ||
      createdOrder.paymentStatus === "PAID"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      pollOrderStatus(createdOrder);
    }, 3000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createdOrder?.code,
    createdOrder?.status,
    createdOrder?.paymentStatus,
    pollOrderStatus,
  ]);

  // Live 15:00 countdown timer
  useEffect(() => {
    if (
      !createdOrder?.expiresAt ||
      createdOrder.status !== "INITIAL" ||
      createdOrder.paymentStatus === "PAID"
    ) {
      setCountdownMs(0);
      return;
    }

    const updateRemaining = () => {
      const target = new Date(createdOrder.expiresAt!).getTime();
      const diff = Math.max(0, target - Date.now());
      setCountdownMs(diff);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [
    createdOrder?.expiresAt,
    createdOrder?.status,
    createdOrder?.paymentStatus,
  ]);

  async function handleSimulateSandboxPayment() {
    if (!createdOrder) return;
    setSimulatingSandbox(true);
    setSandboxNotice(null);
    try {
      const res = await fetch(
        `/api/client/orders/${encodeURIComponent(createdOrder.code)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: createdOrder.phone }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setSandboxNotice(data.message || "Không thể mô phỏng thanh toán");
        return;
      }
      await pollOrderStatus(createdOrder);
    } catch {
      setSandboxNotice("Lỗi kết nối khi gọi Sandbox Webhook");
    } finally {
      setSimulatingSandbox(false);
    }
  }

  // Confirmation View after successful checkout
  if (createdOrder) {
    const isPaid = createdOrder.paymentStatus === "PAID";
    const isCancelled = createdOrder.status === "CANCELLED";
    const isAwaitingOnline =
      createdOrder.status === "INITIAL" &&
      !isPaid &&
      createdOrder.paymentMethod !== "CASH";

    const voucherHref = `/orders/${encodeURIComponent(
      createdOrder.code
    )}/voucher?phone=${encodeURIComponent(createdOrder.phone)}`;

    return (
      <div className="max-w-[900px] mx-auto px-4 py-8 sm:py-10">
        <div
          className="bg-white rounded-[16px] border border-subtle p-6 sm:p-8"
          style={{ boxShadow: "0 10px 30px rgba(22,34,41,0.06)" }}
        >
          <div className="flex flex-col items-center text-center pb-6 border-b border-subtle">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isCancelled
                  ? "bg-status-danger-bg text-status-danger"
                  : isPaid
                    ? "bg-status-success-bg text-status-success"
                    : "bg-client-soft text-client-primary"
              }`}
            >
              {isCancelled ? (
                <AlertCircle className="w-9 h-9" />
              ) : (
                <CheckCircle2 className="w-9 h-9" />
              )}
            </div>

            <h1 className="text-[24px] sm:text-[28px] font-bold text-ink">
              {isPaid && !isCancelled
                ? "Thanh Toán & Xác Nhận Thành Công!"
                : isCancelled
                  ? "Đơn Hàng Đã Hủy / Hết Thời Gian Giữ Chỗ"
                  : "Đặt Tour Thành Công!"}
            </h1>
            <p className="text-[14px] text-ink-muted mt-1.5 max-w-[540px]">
              {isPaid && !isCancelled
                ? "Hệ thống đã ghi nhận thanh toán và xuất e-Voucher điện tử cho hành trình của bạn."
                : isCancelled
                  ? createdOrder.refundStatus === "REFUND_REQUIRED"
                    ? "Thanh toán đến sau khi hết hạn giữ chỗ. Bộ phận CSKH VN.TRAVEL đã tiếp nhận yêu cầu hoàn tiền cho bạn."
                    : "Thời gian giữ chỗ 15 phút đã kết thúc và số chỗ đã được hoàn trả."
                  : "Cảm ơn bạn đã đặt tour tại VN.TRAVEL. Vui lòng hoàn tất thanh toán để kích hoạt e-Voucher tự động."}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-client-soft border border-client-border text-client-primary text-[14px] font-bold tabular-nums">
                <span>Mã đơn hàng:</span>
                <span>{createdOrder.code}</span>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[13px] font-semibold ${
                  isPaid
                    ? "bg-status-success-bg border-status-success-border text-status-success"
                    : isCancelled
                      ? "bg-status-danger-bg border-status-danger-border text-status-danger"
                      : "bg-status-warn-bg border-status-warn-border text-status-warn"
                }`}
              >
                {isPaid
                  ? "Đã thanh toán"
                  : isCancelled
                    ? "Đã hủy"
                    : "Chờ thanh toán"}
              </span>

              {createdOrder.refundStatus === "REFUND_REQUIRED" && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border bg-status-warn-bg border-status-warn-border text-status-warn text-[13px] font-semibold">
                  Cần hoàn tiền
                </span>
              )}
            </div>

            {isAwaitingOnline && createdOrder.expiresAt && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-status-warn-bg border border-status-warn-border text-status-warn text-[13px] font-semibold tabular-nums">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Thời gian giữ chỗ còn lại:{" "}
                  <strong className="text-[15px]">
                    {formatCountdown(countdownMs)}
                  </strong>
                </span>
              </div>
            )}
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
            {createdOrder.email && (
              <div>
                <span className="text-ink-muted">Email nhận e-Voucher:</span>{" "}
                <strong className="text-ink">{createdOrder.email}</strong>
              </div>
            )}
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

          {!isPaid && !isCancelled && (
            <>
              {createdOrder.paymentMethod === "BANK_TRANSFER" && (
                <BankTransferInfoBox
                  orderCode={createdOrder.code}
                  amount={createdOrder.total}
                />
              )}
              {createdOrder.paymentMethod === "MOMO" && (
                <MomoInfoBox orderCode={createdOrder.code} />
              )}

              {sandboxEnabled && createdOrder.paymentMethod !== "CASH" && (
                <div className="mt-4 rounded-[12px] border border-client-border bg-surface-page p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[13px] text-ink">
                    <p className="font-bold text-client-primary flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Chế độ kiểm thử thanh toán (Sandbox Webhook)</span>
                    </p>
                    <p className="text-ink-muted text-[12px] mt-0.5">
                      Bấm nút bên cạnh để giả lập ngân hàng gửi Webhook ký HMAC
                      xác nhận thanh toán ngay lập tức.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={simulatingSandbox}
                    onClick={handleSimulateSandboxPayment}
                    className="shrink-0 px-4 py-2.5 rounded-[8px] bg-client-accent hover:bg-client-accent-hover disabled:opacity-60 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {simulatingSandbox && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    <span>Mô phỏng thanh toán thành công</span>
                  </button>
                </div>
              )}

              {sandboxNotice && (
                <p className="mt-2 text-[12px] text-status-danger font-medium">
                  {sandboxNotice}
                </p>
              )}
            </>
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
                <div className="space-y-0.5">
                  <p className="font-bold text-ink">{item.name}</p>
                  <p className="text-ink-muted text-[12px]">
                    Khởi hành:{" "}
                    <strong className="text-ink tabular-nums">
                      {formatDateVN(item.departureDate)}
                    </strong>{" "}
                    tại{" "}
                    <strong className="text-ink">
                      {item.departureLocation}
                    </strong>
                    {item.departureCode && (
                      <span className="ml-2 text-client-primary font-semibold tabular-nums">
                        ({item.departureCode})
                      </span>
                    )}
                  </p>
                  {(item.airline || item.flightOut) && (
                    <p className="text-ink-muted text-[12px] flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-client-primary" />
                      <span>
                        {item.airline}
                        {item.flightOut ? ` • Đi: ${item.flightOut}` : ""}
                        {item.flightBack ? ` • Về: ${item.flightBack}` : ""}
                      </span>
                    </p>
                  )}
                </div>
                <div className="text-right space-y-0.5 shrink-0">
                  <div className="text-client-primary font-semibold tabular-nums">
                    NL: {item.quantityAdult} | TE: {item.quantityChild} | EB:{" "}
                    {item.quantityBaby}
                  </div>
                  {(item.singleRoomCount || 0) > 0 && (
                    <div className="text-[12px] text-ink-muted tabular-nums">
                      Phụ thu phòng đơn: {item.singleRoomCount} phòng
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={voucherHref}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[14px] transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Xem &amp; In e-Voucher (QR)</span>
            </Link>

            {currentUser ? (
              <Link
                href="/account/orders"
                className="px-6 py-2.5 rounded-[8px] border border-client-primary text-client-primary hover:bg-client-soft font-semibold text-[14px] transition-colors"
              >
                Quản lý đơn hàng
              </Link>
            ) : (
              <Link
                href="/login?next=/account/orders"
                className="px-6 py-2.5 rounded-[8px] border border-client-primary text-client-primary hover:bg-client-soft font-semibold text-[14px] transition-colors"
              >
                Đăng nhập để theo dõi đơn
              </Link>
            )}
            <Link
              href="/tours"
              className="px-6 py-2.5 rounded-[8px] border border-strong hover:border-client-primary hover:text-client-primary text-ink font-semibold text-[14px] transition-colors"
            >
              Tiếp tục khám phá Tour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showClearCouponBtn = Boolean(appliedCoupon || couponInput);

  return (
    <div className="max-w-[980px] mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* 3-Step Checkout Stepper */}
      {hydrated && items.length > 0 && (
        <nav
          aria-label="Tiến trình đặt tour"
          className="bg-white rounded-[16px] border border-subtle p-4 sm:px-6"
          style={{ boxShadow: "0 4px 16px rgba(22,34,41,0.04)" }}
        >
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {STEPS.map((s) => {
              const isCurrent = step === s.step;
              const isCompleted = step > s.step;
              const canJumpBack = s.step < step;
              return (
                <li key={s.step}>
                  <button
                    type="button"
                    disabled={!canJumpBack}
                    onClick={() => {
                      if (canJumpBack) setStep(s.step);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border text-left transition-colors ${
                      isCurrent
                        ? "bg-client-soft border-client-border text-client-primary"
                        : isCompleted
                          ? "bg-status-success-bg border-status-success-border text-status-success hover:opacity-90 cursor-pointer"
                          : "bg-surface-page border-subtle text-ink-muted cursor-default"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                        isCurrent
                          ? "bg-client-primary text-white"
                          : isCompleted
                            ? "bg-status-success text-white"
                            : "bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : s.step}
                    </span>
                    <span className="text-[13.5px] font-bold truncate">
                      {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Empty or Loading State */}
      {!hydrated ? (
        <section className="bg-white rounded-[16px] border border-subtle p-10 text-center text-[14px] text-ink-muted">
          Đang tải giỏ hàng...
        </section>
      ) : items.length === 0 ? (
        <section className="bg-white rounded-[16px] border border-subtle p-10 text-center shadow-sm">
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
        </section>
      ) : (
        <>
          {/* STEP 1: Giỏ hàng & Dịch vụ */}
          {step === 1 && (
            <section
              className="bg-white rounded-[16px] border border-subtle p-5 sm:p-7 space-y-5"
              style={{ boxShadow: "0 4px 16px rgba(22,34,41,0.04)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-subtle">
                <h1 className="text-[20px] sm:text-[24px] font-bold text-ink">
                  1. Giỏ Hàng &amp; Dịch Vụ
                </h1>
                <Link
                  href="/tours"
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-client-primary hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại chọn tour</span>
                </Link>
              </div>

              {syncNotices.length > 0 && (
                <div
                  role="status"
                  className="rounded-[12px] bg-status-warn-bg border border-status-warn-border p-3.5 text-[12.5px] text-status-warn flex items-start justify-between gap-3"
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
              <div className="py-2 flex items-center justify-between border-b border-subtle text-[13px] tabular-nums">
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
                  const usedBySameBucket = items.reduce(
                    (acc, other) => {
                      const sameBucket = item.departureId
                        ? other.departureId === item.departureId
                        : !other.departureId && other.tourId === item.tourId;
                      if (!sameBucket) return acc;
                      return {
                        adult: acc.adult + other.quantityAdult,
                        child: acc.child + other.quantityChild,
                        baby: acc.baby + other.quantityBaby,
                      };
                    },
                    { adult: 0, child: 0, baby: 0 }
                  );

                  const singleCount = item.singleRoomCount || 0;
                  const singleUnitPrice = item.singleRoomSurcharge || 0;

                  return (
                    <div
                      key={item.cartKey}
                      className={`py-5 flex flex-col lg:flex-row gap-4 lg:items-start justify-between ${
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
                            {item.departureCode && (
                              <span className="ml-2 text-client-primary font-semibold tabular-nums">
                                • Lịch: {item.departureCode}
                              </span>
                            )}
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
                          {(item.airline || item.flightOut) && (
                            <p className="text-[12px] text-client-primary flex items-center gap-1.5 font-medium">
                              <Plane className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {item.airline}
                                {item.flightOut
                                  ? ` (${item.flightOut}${
                                      item.flightBack
                                        ? ` / ${item.flightBack}`
                                        : ""
                                    })`
                                  : ""}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Quantities + Single Room Surcharge */}
                      <div className="lg:w-[355px] shrink-0 space-y-2.5 pl-0">
                        <p className="text-[12px] font-semibold text-ink-muted">
                          Số Lượng Hành Khách &amp; Dịch Vụ
                        </p>

                        {[
                          {
                            name: "Người lớn",
                            label: "Người lớn:",
                            tier: "adult" as const,
                            qty: item.quantityAdult,
                            minQty: item.stockAdult > 0 ? 1 : 0,
                            totalUsed: usedBySameBucket.adult,
                            stock: item.stockAdult,
                            price: item.priceNewAdult,
                          },
                          {
                            name: "Trẻ em",
                            label: "Trẻ em:",
                            tier: "child" as const,
                            qty: item.quantityChild,
                            minQty: 0,
                            totalUsed: usedBySameBucket.child,
                            stock: item.stockChild,
                            price: item.priceNewChild,
                          },
                          {
                            name: "Em bé",
                            label: "Em bé:",
                            tier: "baby" as const,
                            qty: item.quantityBaby,
                            minQty: 0,
                            totalUsed: usedBySameBucket.baby,
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
                              <span className="text-ink w-[84px] shrink-0">
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
                                  className={`w-9 h-9 flex items-center justify-center transition-colors ${
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
                                  className={`w-9 h-9 flex items-center justify-center transition-colors ${
                                    atMax
                                      ? "text-ink-muted opacity-40 cursor-not-allowed bg-surface-page"
                                      : "hover:bg-surface-muted text-ink"
                                  }`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="min-w-[96px] text-right font-semibold text-ink-muted text-[12px] tabular-nums shrink-0">
                                {row.qty} x{" "}
                                <span className="text-client-accent font-bold">
                                  {row.price.toLocaleString("vi-VN")}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Single Room Surcharge Stepper */}
                        {singleUnitPrice > 0 && item.quantityAdult > 0 && (
                          <div className="pt-2 mt-2 border-t border-subtle flex flex-wrap items-center justify-between gap-2 text-[13px]">
                            <span
                              className="text-ink w-[84px] shrink-0 inline-flex items-center gap-1"
                              title="Phụ thu ở phòng riêng (tối đa bằng số người lớn)"
                            >
                              <BedDouble className="w-3.5 h-3.5 text-client-primary shrink-0" />
                              <span>Phòng đơn</span>
                            </span>

                            <div className="flex items-center border border-strong rounded-[8px] overflow-hidden shrink-0">
                              <button
                                type="button"
                                aria-label="Giảm số phòng đơn"
                                disabled={isInactive || singleCount <= 0}
                                onClick={() =>
                                  updateSingleRoomCount(
                                    item.cartKey,
                                    singleCount - 1
                                  )
                                }
                                className={`w-9 h-9 flex items-center justify-center transition-colors ${
                                  isInactive || singleCount <= 0
                                    ? "text-ink-muted opacity-50 cursor-not-allowed bg-surface-page"
                                    : "hover:bg-surface-muted text-ink"
                                }`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-[13px] font-bold text-ink tabular-nums shrink-0">
                                {singleCount}
                              </span>
                              <button
                                type="button"
                                aria-label="Tăng số phòng đơn"
                                disabled={
                                  isInactive || singleCount >= item.quantityAdult
                                }
                                onClick={() =>
                                  updateSingleRoomCount(
                                    item.cartKey,
                                    singleCount + 1
                                  )
                                }
                                className={`w-9 h-9 flex items-center justify-center transition-colors ${
                                  isInactive || singleCount >= item.quantityAdult
                                    ? "text-ink-muted opacity-40 cursor-not-allowed bg-surface-page"
                                    : "hover:bg-surface-muted text-ink"
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="min-w-[96px] text-right font-semibold text-ink-muted text-[12px] tabular-nums shrink-0">
                              {singleCount} x{" "}
                              <span className="text-client-primary font-bold">
                                {singleUnitPrice.toLocaleString("vi-VN")}
                              </span>
                            </div>
                          </div>
                        )}

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
                    <span className="text-ink-muted">Tạm tính:</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {formatCurrencyVND(checkedSubTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-ink-muted">Giảm giá:</span>
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

              {submitError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[8px] bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] font-medium"
                >
                  {submitError}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  disabled={checkedItems.length === 0}
                  className="w-full sm:w-auto px-7 h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover disabled:opacity-50 text-white font-bold text-[14.5px] inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Tiếp tục: Nhập thông tin hành khách</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: Hành khách & Liên hệ */}
          {step === 2 && (
            <section
              className="bg-white rounded-[16px] border border-subtle p-5 sm:p-7 space-y-6"
              style={{ boxShadow: "0 4px 16px rgba(22,34,41,0.04)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-subtle">
                <h1 className="text-[20px] sm:text-[24px] font-bold text-ink">
                  2. Hành Khách &amp; Thông Tin Liên Hệ
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-client-primary hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại giỏ hàng</span>
                </button>
              </div>

              {/* Contact Info */}
              <div>
                <h2 className="text-[16px] font-bold text-ink mb-3.5 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-client-primary" />
                  <span>Thông tin người đặt / Liên hệ chính</span>
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
                          setFieldErrors((prev) => ({
                            ...prev,
                            fullName: undefined,
                          }));
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
                          setFieldErrors((prev) => ({
                            ...prev,
                            phone: undefined,
                          }));
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
                      htmlFor="checkout-email"
                      className="block text-[13px] font-medium text-ink mb-1.5"
                    >
                      Email nhận e-Voucher{" "}
                      <span className="text-status-danger">*</span>
                    </label>
                    <input
                      ref={emailInputRef}
                      id="checkout-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            email: undefined,
                          }));
                        }
                      }}
                      placeholder="Ví dụ: an.nguyen@gmail.com"
                      aria-invalid={Boolean(fieldErrors.email)}
                      className={`scroll-mt-32 w-full h-[44px] px-3.5 rounded-[8px] border text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
                        fieldErrors.email
                          ? "border-status-danger bg-status-danger-bg/40"
                          : "border-strong"
                      }`}
                    />
                    {fieldErrors.email && (
                      <p
                        role="alert"
                        className="mt-1.5 text-[12px] text-status-danger font-medium"
                      >
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="checkout-note"
                      className="block text-[13px] font-medium text-ink mb-1.5"
                    >
                      Ghi chú thêm
                    </label>
                    <textarea
                      id="checkout-note"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Yêu cầu đặc biệt (phòng view biển, ăn chay, xuất hóa đơn VAT...)"
                      className="w-full p-3.5 rounded-[8px] border border-strong text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* Passenger Manifest */}
              <div className="pt-4 border-t border-subtle space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[16px] font-bold text-ink flex items-center gap-2">
                    <Users className="w-5 h-5 text-client-primary" />
                    <span>
                      Danh sách hành khách ({passengerSlots.length} khách)
                    </span>
                  </h2>
                  {fullName.trim() && passengerSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={quickFillFirstPassenger}
                      className="px-3.5 py-1.5 rounded-[8px] border border-client-border bg-client-soft text-client-primary hover:bg-client-border/40 text-[12.5px] font-semibold transition-colors"
                    >
                      Lấy thông tin người đặt làm Hành khách 1
                    </button>
                  )}
                </div>

                {fieldErrors.passengers && (
                  <div
                    role="alert"
                    className="p-3 rounded-[8px] bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] font-medium"
                  >
                    {fieldErrors.passengers}
                  </div>
                )}

                <div className="space-y-3.5">
                  {passengerSlots.map((slot, idx) => {
                    const p = passengers[idx] || {
                      fullName: "",
                      gender: "MALE" as const,
                      birthDate: "",
                      tier: slot.tier,
                      documentNumber: "",
                    };
                    return (
                      <div
                        key={slot.key}
                        className="rounded-[12px] border border-subtle bg-surface-page p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                          <span className="font-bold text-ink">
                            Hành khách {idx + 1} —{" "}
                            <span className="text-client-primary">
                              {slot.tierLabel}
                            </span>
                          </span>
                          <span className="text-[12px] text-ink-muted truncate max-w-[320px]">
                            {slot.tourName}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="lg:col-span-2">
                            <label className="block text-[12px] font-medium text-ink-muted mb-1">
                              Họ và tên{" "}
                              <span className="text-status-danger">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={p.fullName}
                              onChange={(e) =>
                                updatePassengerField(
                                  idx,
                                  "fullName",
                                  e.target.value
                                )
                              }
                              placeholder="Họ tên theo CCCD / Hộ chiếu"
                              className="w-full h-[40px] px-3 rounded-[8px] border border-strong bg-white text-[13.5px] text-ink focus:outline-none focus:border-client-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[12px] font-medium text-ink-muted mb-1">
                              Giới tính{" "}
                              <span className="text-status-danger">*</span>
                            </label>
                            <select
                              value={p.gender}
                              onChange={(e) =>
                                updatePassengerField(
                                  idx,
                                  "gender",
                                  e.target.value
                                )
                              }
                              className="w-full h-[40px] px-3 rounded-[8px] border border-strong bg-white text-[13.5px] text-ink focus:outline-none focus:border-client-primary"
                            >
                              <option value="MALE">Nam</option>
                              <option value="FEMALE">Nữ</option>
                              <option value="OTHER">Khác</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[12px] font-medium text-ink-muted mb-1">
                              Ngày sinh{" "}
                              <span className="text-status-danger">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={p.birthDate}
                              onChange={(e) =>
                                updatePassengerField(
                                  idx,
                                  "birthDate",
                                  e.target.value
                                )
                              }
                              className="w-full h-[40px] px-3 rounded-[8px] border border-strong bg-white text-[13.5px] text-ink tabular-nums focus:outline-none focus:border-client-primary"
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-4">
                            <label className="block text-[12px] font-medium text-ink-muted mb-1">
                              CCCD / Hộ chiếu (không bắt buộc)
                            </label>
                            <input
                              type="text"
                              value={p.documentNumber || ""}
                              onChange={(e) =>
                                updatePassengerField(
                                  idx,
                                  "documentNumber",
                                  e.target.value
                                )
                              }
                              placeholder="Nhập số CCCD hoặc số hộ chiếu (nếu có)"
                              className="w-full h-[40px] px-3 rounded-[8px] border border-strong bg-white text-[13.5px] text-ink tabular-nums focus:outline-none focus:border-client-primary"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[8px] bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] font-medium"
                >
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setStep(1);
                  }}
                  className="px-5 h-[44px] rounded-[10px] border border-strong text-ink hover:border-client-primary hover:text-client-primary font-semibold text-[14px] inline-flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToStep3}
                  className="w-full sm:w-auto px-7 h-[46px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-bold text-[14.5px] inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Tiếp tục: Chọn thanh toán</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* STEP 3: Thanh toán & Xác nhận */}
          {step === 3 && (
            <form
              noValidate
              onSubmit={handleCheckoutSubmit}
              className="bg-white rounded-[16px] border border-subtle p-5 sm:p-7 space-y-6"
              style={{ boxShadow: "0 4px 16px rgba(22,34,41,0.04)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-subtle">
                <h1 className="text-[20px] sm:text-[24px] font-bold text-ink">
                  3. Thanh Toán &amp; Xác Nhận Đơn Hàng
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setStep(2);
                  }}
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-client-primary hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Sửa thông tin hành khách</span>
                </button>
              </div>

              {/* Compact Order Summary */}
              <div className="rounded-[12px] bg-surface-page border border-subtle p-4 space-y-3 text-[13.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-subtle">
                  <div>
                    <span className="text-ink-muted">Người đặt:</span>{" "}
                    <strong className="text-ink">{fullName}</strong> •{" "}
                    <span className="tabular-nums">{phone}</span> •{" "}
                    <span>{email}</span>
                  </div>
                  <span className="text-client-primary font-bold tabular-nums">
                    {passengerSlots.length} hành khách
                  </span>
                </div>

                <div className="space-y-1.5">
                  {checkedItems.map((item) => (
                    <div
                      key={item.cartKey}
                      className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="font-semibold text-ink">
                        {item.name}{" "}
                        <span className="text-ink-muted font-normal">
                          ({formatDateVN(item.departureDate)} •{" "}
                          {item.departureLocation})
                        </span>
                      </span>
                      <span className="text-ink-muted tabular-nums">
                        NL: {item.quantityAdult} | TE: {item.quantityChild} | EB:{" "}
                        {item.quantityBaby}
                        {(item.singleRoomCount || 0) > 0
                          ? ` | P.Đơn: ${item.singleRoomCount}`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-subtle flex items-center justify-between font-bold text-[15px] tabular-nums">
                  <span className="text-ink">Tổng thanh toán:</span>
                  <span className="text-[20px] text-client-accent">
                    {formatCurrencyVND(finalTotal)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h2 className="text-[17px] font-bold text-ink mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-client-primary" />
                  <span>Chọn phương thức thanh toán</span>
                </h2>

                <div className="space-y-2.5 text-[14px]">
                  {(
                    ["BANK_TRANSFER", "MOMO", "CASH"] as PaymentMethodType[]
                  ).map((method) => (
                    <label
                      key={method}
                      className={`flex items-center gap-3 p-3.5 rounded-[10px] border cursor-pointer transition-colors ${
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
                  ))}
                </div>

                {paymentMethod === "BANK_TRANSFER" && (
                  <BankTransferInfoBox amount={finalTotal} />
                )}
                {paymentMethod === "MOMO" && <MomoInfoBox />}
              </div>

              {/* Mandatory Terms Checkbox */}
              <div className="rounded-[12px] border border-subtle bg-surface-page p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer text-[13.5px] text-ink">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => {
                      setAgreedTerms(e.target.checked);
                      if (fieldErrors.agreedTerms) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          agreedTerms: undefined,
                        }));
                      }
                    }}
                    className="w-4 h-4 mt-0.5 accent-client-primary rounded shrink-0"
                  />
                  <span>
                    Tôi đã đọc kỹ và đồng ý với{" "}
                    <strong className="text-client-primary">
                      Điều khoản đặt tour, Chính sách giữ chỗ 15 phút &amp; Chính
                      sách hoàn hủy
                    </strong>{" "}
                    của VN.TRAVEL. <span className="text-status-danger">*</span>
                  </span>
                </label>
                {fieldErrors.agreedTerms && (
                  <p
                    role="alert"
                    className="text-[12px] text-status-danger font-medium pl-7"
                  >
                    {fieldErrors.agreedTerms}
                  </p>
                )}
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[8px] bg-status-danger-bg border border-status-danger-border text-status-danger text-[13px] font-medium"
                >
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setStep(2);
                  }}
                  className="px-5 h-[46px] rounded-[10px] border border-strong text-ink hover:border-client-primary hover:text-client-primary font-semibold text-[14px] inline-flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting || checkedItems.length === 0}
                  className="w-full sm:w-[300px] h-[48px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover disabled:opacity-50 text-white font-bold text-[15px] tracking-wide inline-flex items-center justify-center gap-2 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang giữ chỗ &amp; tạo đơn...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Xác Nhận Đặt Tour</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
