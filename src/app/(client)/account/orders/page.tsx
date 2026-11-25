"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Loader2,
  MapPin,
  PackageOpen,
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
  total: number;
  paymentMethod: "CASH" | "MOMO" | "BANK_TRANSFER";
  paymentStatus: "UNPAID" | "PAID";
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
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "Đã duyệt",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  CANCELLED: {
    label: "Đã hủy",
    cls: "bg-red-100 text-red-700 border-red-200",
  },
};

const PAYMENT_LABELS: Record<CustomerOrder["paymentMethod"], string> = {
  CASH: "Tiền mặt khi đi tour",
  MOMO: "Ví MoMo",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
};

export default function CustomerOrdersPage() {
  const { currentUser } = useClientMeta();
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
      await fetchOrders();
    } catch {
      setFeedback({
        type: "error",
        text: "Không thể kết nối máy chủ",
      });
    } finally {
      setCancellingId(null);
    }
  }

  if (!currentUser) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-14 text-center">
        <div className="bg-white rounded-[16px] border border-[#ECECEC] p-8 shadow-sm space-y-4">
          <UserCheck className="w-12 h-12 mx-auto text-[#4502C7]" />
          <h1 className="text-[22px] font-bold text-[#25282B]">
            Đăng nhập để xem lịch sử đặt tour
          </h1>
          <p className="text-[14px] text-[#667479]">
            Theo dõi trạng thái đơn hàng, thông tin thanh toán và lịch khởi hành
            của riêng bạn.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/account/orders"
              className="px-6 py-2.5 rounded-[10px] bg-[#4502C7] text-white font-semibold text-[14px] hover:bg-[#36019e]"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/tours"
              className="px-6 py-2.5 rounded-[10px] border border-[#CCD1D2] text-[#25282B] font-semibold text-[14px] hover:border-[#4502C7]"
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
      <h1 className="text-[24px] sm:text-[28px] font-bold text-[#4502C7] mb-6">
        Đơn Hàng Của Tôi
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <AccountSidebar />
        </div>

        <div className="lg:col-span-8 space-y-5">
          {/* Status Filter Tabs */}
          <div className="bg-white rounded-[14px] border border-[#ECECEC] p-3 flex flex-wrap gap-2 shadow-sm">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors ${
                  statusFilter === tab.key
                    ? "bg-[#4502C7] text-white"
                    : "bg-[#F6F6F6] text-[#25282B] hover:bg-[#4502C7]/10 hover:text-[#4502C7]"
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
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-[#DA0808] border border-red-200"
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
                  className="h-[180px] rounded-[16px] bg-white border border-[#ECECEC] animate-pulse"
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-[16px] border border-[#ECECEC] p-12 text-center shadow-sm">
              <PackageOpen className="w-12 h-12 mx-auto text-[#667085] mb-3" />
              <p className="text-[16px] font-bold text-[#25282B]">
                Chưa có đơn hàng nào
              </p>
              <p className="text-[13px] text-[#667479] mt-1">
                Hãy khám phá các hành trình hấp dẫn của VN.TRAVEL để đặt chuyến
                đi đầu tiên nhé!
              </p>
              <Link
                href="/tours"
                className="mt-5 inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] bg-[#4502C7] text-white text-[14px] font-semibold hover:bg-[#36019e]"
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
                    className="bg-white rounded-[16px] border border-[#ECECEC] p-5 shadow-sm space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#ECECEC]">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[16px] font-bold text-[#4502C7]">
                            #{order.code}
                          </span>
                          <span
                            className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#667479] mt-0.5">
                          Đặt lúc: {formatDateTimeVN(order.createdAt)} • Thanh
                          toán: <strong>{PAYMENT_LABELS[order.paymentMethod]}</strong> (
                          {order.paymentStatus === "PAID"
                            ? "Đã thanh toán"
                            : "Chưa thanh toán"}
                          )
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[12px] text-[#667479]">Tổng tiền</p>
                        <p className="text-[18px] font-extrabold text-[#DA0808]">
                          {formatCurrencyVND(order.total)}
                        </p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row gap-3.5 bg-[#F6F6F6] rounded-[12px] p-3"
                        >
                          <div className="relative w-full sm:w-[115px] aspect-[16/10] rounded-[8px] overflow-hidden shrink-0 bg-white">
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
                                className="text-[14px] font-bold text-[#25282B] hover:text-[#4502C7] line-clamp-2"
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <p className="text-[14px] font-bold text-[#25282B] line-clamp-2">
                                {item.name}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#667479]">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-[#4502C7]" />
                                {formatDateVN(item.departureDate)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#4502C7]" />
                                {item.departureLocation}
                              </span>
                            </div>
                            <p className="text-[12px] font-semibold text-[#4502C7]">
                              Người lớn: {item.quantityAdult} • Trẻ em:{" "}
                              {item.quantityChild} • Em bé: {item.quantityBaby}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.paymentMethod === "BANK_TRANSFER" &&
                      order.paymentStatus === "UNPAID" &&
                      order.status !== "CANCELLED" && (
                        <BankTransferInfoBox orderCode={order.code} />
                      )}

                    {order.paymentMethod === "MOMO" &&
                      order.paymentStatus === "UNPAID" &&
                      order.status !== "CANCELLED" && (
                        <MomoInfoBox orderCode={order.code} />
                      )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px] text-[#667479]">
                      <div>
                        {order.couponCode && (
                          <span>
                            Mã giảm: <strong>{order.couponCode}</strong> (-
                            {formatCurrencyVND(order.discount)})
                          </span>
                        )}
                      </div>

                      {order.status === "INITIAL" && (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] border border-[#DA0808]/40 text-[#DA0808] hover:bg-red-50 font-semibold text-[13px] transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Hủy đơn hàng</span>
                        </button>
                      )}
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
            className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-2xl border border-[#ECECEC] space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-[#DA0808] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="cancel-order-dialog-title"
                  className="text-[17px] font-bold text-[#25282B]"
                >
                  Xác nhận hủy đơn #{confirmCancelOrder.code}?
                </h3>
                <p className="text-[13px] text-[#667479] mt-1">
                  Đơn hàng sẽ chuyển sang trạng thái Đã hủy và hệ thống tự động
                  hoàn trả số chỗ đã giữ.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCancelOrder(null)}
                className="px-4 py-2 rounded-[8px] border border-[#CCD1D2] text-[13px] font-semibold text-[#25282B]"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={cancellingId === confirmCancelOrder.id}
                onClick={() => handleCancelOrder(confirmCancelOrder)}
                className="px-4 py-2 rounded-[8px] bg-[#DA0808] hover:bg-red-700 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
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
