"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  FileText,
  Link2,
  Loader2,
  MapPin,
  PackageOpen,
  Plane,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { AccountSidebar } from "@/components/client/AccountSidebar";
import {
  BankTransferInfoBox,
  MomoInfoBox,
} from "@/components/client/BankTransferInfoBox";
import { SmartImage } from "@/components/client/SmartImage";
import {
  formatCurrencyVND,
  formatDateTimeVN,
  formatDateVN,
} from "@/lib/format";

interface CustomerOrderItem {
  id: string;
  tourId: string | null;
  departureCode?: string | null;
  airline?: string | null;
  flightOut?: string | null;
  flightBack?: string | null;
  name: string;
  avatar: string | null;
  departureDate: string | null;
  departureLocation: string;
  quantityAdult: number;
  priceNewAdult: number;
  quantityChild: number;
  priceNewChild: number;
  quantityBaby: number;
  priceNewBaby: number;
  singleRoomCount?: number;
  singleRoomSurcharge?: number;
  tour?: { slug: string } | null;
}

interface CustomerOrder {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  note: string | null;
  subTotal: number;
  discount: number;
  couponCode: string | null;
  pointsRedeemed?: number;
  pointsDiscount?: number;
  pointsEarned?: number;
  total: number;
  paymentMethod: "CASH" | "MOMO" | "BANK_TRANSFER";
  paymentStatus: "UNPAID" | "PAID";
  refundStatus?: "NONE" | "REFUND_REQUIRED" | "REFUNDED";
  status: "INITIAL" | "APPROVED" | "CANCELLED";
  createdAt: string;
  items: CustomerOrderItem[];
}

const STATUS_TABS = [
  { key: "", label: "Tất cả" },
  { key: "INITIAL", label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đã duyệt" },
  { key: "CANCELLED", label: "Đã hủy" },
];

const STATUS_BADGES: Record<
  CustomerOrder["status"],
  { label: string; cls: string }
> = {
  INITIAL: {
    label: "Chờ duyệt",
    cls: "bg-status-warn-bg text-status-warn border-status-warn-border",
  },
  APPROVED: {
    label: "Đã duyệt",
    cls: "bg-status-success-bg text-status-success border-status-success-border",
  },
  CANCELLED: {
    label: "Đã hủy",
    cls: "bg-status-danger-bg text-status-danger border-status-danger-border",
  },
};

const PAYMENT_LABELS: Record<CustomerOrder["paymentMethod"], string> = {
  CASH: "Tiền mặt khi đi tour",
  MOMO: "Ví MoMo",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
};

export default function CustomerOrdersPage() {
  const { currentUser, refreshUser } = useClientMeta();
  const [statusFilter, setStatusFilter] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelOrder, setConfirmCancelOrder] =
    useState<CustomerOrder | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [claimCode, setClaimCode] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/client/account/orders${qs}`);
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!confirmCancelOrder) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && cancellingId !== confirmCancelOrder.id) {
        setConfirmCancelOrder(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmCancelOrder, cancellingId]);

  async function handleCancelOrder(order: CustomerOrder) {
    setCancellingId(order.id);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/client/account/orders/${encodeURIComponent(order.id)}/cancel`,
        { method: "PATCH" }
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.message || "Không thể hủy đơn hàng",
        });
        return;
      }
      setFeedback({
        type: "success",
        text: data.message || `Đã hủy đơn ${order.code}`,
      });
      setConfirmCancelOrder(null);
      await Promise.all([fetchOrders(), refreshUser()]);
    } catch {
      setFeedback({
        type: "error",
        text: "Không thể kết nối máy chủ",
      });
    } finally {
      setCancellingId(null);
    }
  }

  async function handleClaimOrder(e: React.FormEvent) {
    e.preventDefault();
    setClaimFeedback(null);

    const code = claimCode.trim().toUpperCase();
    const phone = claimPhone.trim();
    if (!code || !phone) {
      setClaimFeedback({
        type: "error",
        text: "Vui lòng nhập đầy đủ mã đơn hàng và số điện thoại đặt đơn.",
      });
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch("/api/client/orders/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "link",
          orderCode: code,
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimFeedback({
          type: "error",
          text: data.message || "Không thể liên kết đơn hàng.",
        });
        return;
      }
      const awardedText =
        typeof data.pointsAwarded === "number" && data.pointsAwarded > 0
          ? ` (+${data.pointsAwarded.toLocaleString("vi-VN")} điểm thưởng)`
          : "";
      setClaimFeedback({
        type: "success",
        text: `${data.message || `Đã liên kết đơn #${code} vào tài khoản!`}${awardedText}`,
      });
      setClaimCode("");
      setClaimPhone("");
      await Promise.all([fetchOrders(), refreshUser()]);
    } catch {
      setClaimFeedback({
        type: "error",
        text: "Không thể kết nối máy chủ.",
      });
    } finally {
      setClaiming(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-[16px] border border-subtle p-8 shadow-sm space-y-4">
          <UserCheck className="w-12 h-12 mx-auto text-client-primary" />
          <h1 className="text-[22px] font-bold text-ink">
            Đăng nhập để xem lịch sử đặt tour
          </h1>
          <p className="text-[14px] text-ink-muted">
            Theo dõi trạng thái đơn hàng, thông tin thanh toán và lịch khởi hành
            của riêng bạn.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/account/orders"
              className="px-6 py-2.5 rounded-[10px] bg-client-primary text-white font-semibold text-[14px] hover:bg-client-primary-hover transition-colors"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/tours"
              className="px-6 py-2.5 rounded-[10px] border border-strong text-ink font-semibold text-[14px] hover:border-client-primary hover:text-client-primary transition-colors"
            >
              Khám phá Tour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
      <h1 className="text-[24px] sm:text-[28px] font-bold text-ink mb-6">
        Đơn Hàng Của Tôi
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <AccountSidebar />
        </div>

        <div className="lg:col-span-8 space-y-5">
          {/* Manual Guest Order Claim Card */}
          <form
            onSubmit={handleClaimOrder}
            className="bg-white rounded-[16px] border border-subtle p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-client-primary shrink-0" />
              <h2 className="text-[15px] font-bold text-ink">
                Liên kết đơn đặt vãng lai
              </h2>
            </div>
            <p className="text-[12px] text-ink-muted">
              Bạn từng đặt tour khi chưa đăng nhập? Nhập mã đơn và số điện thoại
              để đồng bộ đơn về tài khoản và nhận điểm tích lũy.
            </p>

            {claimFeedback && (
              <div
                role="alert"
                className={`p-3 rounded-[10px] text-[13px] font-medium ${
                  claimFeedback.type === "success"
                    ? "bg-status-success-bg text-status-success border border-status-success-border"
                    : "bg-status-danger-bg text-status-danger border border-status-danger-border"
                }`}
              >
                {claimFeedback.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label
                  htmlFor="claim-order-code"
                  className="block text-[12px] font-semibold text-ink mb-1"
                >
                  Mã đơn hàng
                </label>
                <input
                  id="claim-order-code"
                  type="text"
                  required
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value)}
                  placeholder="Ví dụ: OD123456"
                  className="w-full h-[40px] px-3 rounded-[8px] border border-strong text-[13px] text-ink uppercase tabular-nums placeholder:normal-case placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
              <div className="sm:col-span-4">
                <label
                  htmlFor="claim-order-phone"
                  className="block text-[12px] font-semibold text-ink mb-1"
                >
                  Số điện thoại đặt đơn
                </label>
                <input
                  id="claim-order-phone"
                  type="tel"
                  required
                  value={claimPhone}
                  onChange={(e) => setClaimPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full h-[40px] px-3 rounded-[8px] border border-strong text-[13px] text-ink tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={claiming}
                  className="w-full h-[40px] px-4 rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 disabled:opacity-60"
                >
                  {claiming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Liên kết đơn</span>
                </button>
              </div>
            </div>
          </form>

          {/* Status Filter Tabs */}
          <div className="bg-white rounded-[14px] border border-subtle p-3 flex flex-wrap gap-2 shadow-sm">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-primary/40 ${
                  statusFilter === tab.key
                    ? "bg-client-primary text-white"
                    : "bg-surface-muted text-ink hover:bg-client-soft hover:text-client-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {feedback && (
            <div
              role="alert"
              className={`p-3.5 rounded-[10px] text-[13px] font-medium ${
                feedback.type === "success"
                  ? "bg-status-success-bg text-status-success border border-status-success-border"
                  : "bg-status-danger-bg text-status-danger border border-status-danger-border"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[180px] rounded-[16px] bg-surface-muted border border-subtle animate-pulse"
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-[16px] border border-subtle p-12 text-center shadow-sm">
              <PackageOpen className="w-12 h-12 mx-auto text-ink-muted mb-3" />
              <p className="text-[16px] font-bold text-ink">
                Chưa có đơn hàng nào
              </p>
              <p className="text-[13px] text-ink-muted mt-1">
                Hãy khám phá các hành trình hấp dẫn của VN.TRAVEL để đặt chuyến
                đi đầu tiên nhé!
              </p>
              <Link
                href="/tours"
                className="mt-5 inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] bg-client-primary text-white text-[14px] font-semibold hover:bg-client-primary-hover transition-colors"
              >
                Khám Phá Tour Ngay
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const badge = STATUS_BADGES[order.status];
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-[16px] border border-subtle p-5 shadow-sm space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-subtle">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[16px] font-bold text-client-primary tabular-nums">
                            #{order.code}
                          </span>
                          <span
                            className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {order.refundStatus === "REFUND_REQUIRED" && (
                            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full border bg-status-warn-bg text-status-warn border-status-warn-border">
                              Cần hoàn tiền
                            </span>
                          )}
                          {order.refundStatus === "REFUNDED" && (
                            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full border bg-status-success-bg text-status-success border-status-success-border">
                              Đã hoàn tiền
                            </span>
                          )}
                          {(order.pointsEarned ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-0.5 rounded-full border bg-status-success-bg text-status-success border-status-success-border tabular-nums">
                              <Sparkles className="w-3 h-3 shrink-0" />
                              <span>
                                +{(order.pointsEarned ?? 0).toLocaleString("vi-VN")}{" "}
                                điểm thưởng
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-muted mt-0.5 tabular-nums">
                          Đặt lúc: {formatDateTimeVN(order.createdAt)} • Thanh
                          toán:{" "}
                          <strong className="text-ink">
                            {PAYMENT_LABELS[order.paymentMethod]}
                          </strong>{" "}
                          (
                          {order.paymentStatus === "PAID"
                            ? "Đã thanh toán"
                            : "Chưa thanh toán"}
                          )
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[12px] text-ink-muted">Tổng tiền</p>
                        <p className="text-[18px] font-extrabold text-client-accent tabular-nums">
                          {formatCurrencyVND(order.total)}
                        </p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row gap-3.5 bg-surface-page border border-subtle rounded-[12px] p-3"
                        >
                          <div className="relative w-full sm:w-[115px] aspect-[16/10] rounded-[8px] overflow-hidden shrink-0 bg-surface-muted">
                            <SmartImage
                              src={item.avatar}
                              alt={item.name}
                              targetWidth={500}
                              quality={85}
                              sizes="140px"
                              className="object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            {item.tour?.slug ? (
                              <Link
                                href={`/tours/${item.tour.slug}`}
                                className="text-[14px] font-bold text-ink hover:text-client-primary transition-colors line-clamp-2"
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <p className="text-[14px] font-bold text-ink line-clamp-2">
                                {item.name}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-client-primary" />
                                {formatDateVN(item.departureDate)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-client-primary" />
                                {item.departureLocation}
                              </span>
                              {item.departureCode && (
                                <span className="font-semibold text-client-primary">
                                  Mã lịch: {item.departureCode}
                                </span>
                              )}
                            </div>
                            {(item.airline || item.flightOut) && (
                              <p className="text-[12px] text-ink-muted inline-flex items-center gap-1.5">
                                <Plane className="w-3.5 h-3.5 text-client-primary" />
                                <span>
                                  {item.airline}
                                  {item.flightOut
                                    ? ` • ${item.flightOut}${
                                        item.flightBack
                                          ? ` / ${item.flightBack}`
                                          : ""
                                      }`
                                    : ""}
                                </span>
                              </p>
                            )}
                            <p className="text-[12px] font-semibold text-client-primary tabular-nums">
                              Người lớn: {item.quantityAdult} • Trẻ em:{" "}
                              {item.quantityChild} • Em bé: {item.quantityBaby}
                              {(item.singleRoomCount || 0) > 0
                                ? ` • Phòng đơn: ${item.singleRoomCount}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.paymentMethod === "BANK_TRANSFER" &&
                      order.paymentStatus === "UNPAID" &&
                      order.status !== "CANCELLED" && (
                        <BankTransferInfoBox
                          orderCode={order.code}
                          amount={order.total}
                        />
                      )}

                    {order.paymentMethod === "MOMO" &&
                      order.paymentStatus === "UNPAID" &&
                      order.status !== "CANCELLED" && (
                        <MomoInfoBox orderCode={order.code} />
                      )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px] text-ink-muted">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {order.couponCode && (
                          <span className="tabular-nums">
                            Mã giảm:{" "}
                            <strong className="text-ink">
                              {order.couponCode}
                            </strong>{" "}
                            (
                            <span className="text-client-accent font-semibold">
                              -{formatCurrencyVND(order.discount)}
                            </span>
                            )
                          </span>
                        )}
                        {(order.pointsRedeemed ?? 0) > 0 && (
                          <span className="text-client-accent font-semibold tabular-nums">
                            Đổi{" "}
                            {(order.pointsRedeemed ?? 0).toLocaleString("vi-VN")}{" "}
                            điểm (-
                            {formatCurrencyVND(
                              order.pointsDiscount ??
                                (order.pointsRedeemed ?? 0) * 1000
                            )}
                            )
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/orders/${encodeURIComponent(
                            order.code
                          )}/voucher`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] border border-client-border bg-client-soft text-client-primary hover:bg-client-border/40 font-semibold text-[13px] transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Xem e-Voucher</span>
                        </Link>

                        {order.status === "INITIAL" && (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] border border-status-danger-border text-status-danger hover:bg-status-danger-bg hover:text-status-danger font-semibold text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger/40"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Hủy đơn hàng</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmCancelOrder && (
        <div
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              cancellingId !== confirmCancelOrder.id
            ) {
              setConfirmCancelOrder(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-dialog-title"
            className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-2xl border border-subtle space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="cancel-order-dialog-title"
                  className="text-[17px] font-bold text-ink tabular-nums"
                >
                  Xác nhận hủy đơn #{confirmCancelOrder.code}?
                </h3>
                <p className="text-[13px] text-ink-muted mt-1">
                  Đơn hàng sẽ chuyển sang trạng thái Đã hủy và hệ thống tự động
                  hoàn trả số chỗ đã giữ.
                </p>
                {(confirmCancelOrder.pointsRedeemed ?? 0) > 0 && (
                  <p className="text-[12px] font-semibold text-client-primary mt-1.5 tabular-nums">
                    {(confirmCancelOrder.pointsRedeemed ?? 0).toLocaleString(
                      "vi-VN"
                    )}{" "}
                    điểm đã quy đổi sẽ được hoàn trả lại vào ví điểm của bạn.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={cancellingId === confirmCancelOrder.id}
                onClick={() => setConfirmCancelOrder(null)}
                className="px-4 py-2 rounded-[8px] border border-strong hover:bg-surface-muted text-[13px] font-semibold text-ink transition-colors disabled:opacity-60"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={cancellingId === confirmCancelOrder.id}
                onClick={() => handleCancelOrder(confirmCancelOrder)}
                className="px-4 py-2 rounded-[8px] bg-status-danger hover:bg-status-danger/90 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                {cancellingId === confirmCancelOrder.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Xác nhận hủy đơn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
