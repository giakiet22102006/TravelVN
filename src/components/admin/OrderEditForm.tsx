"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Plane, Users } from "lucide-react";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from "@prisma/client";
import { formatCurrencyVND, formatDateTimeVN, formatDateVN } from "@/lib/format";
import type { OrderPassengerInput } from "@/types/ota";

interface OrderDetailItem {
  id: string;
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
  passengers?: OrderPassengerInput[] | unknown;
}

interface OrderDetail {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  note: string | null;
  subTotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  status: OrderStatus;
  createdAt: string;
  items: OrderDetailItem[];
}

const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

const TIER_LABELS: Record<string, string> = {
  ADULT: "Người lớn",
  CHILD: "Trẻ em",
  BABY: "Em bé",
};

export function OrderEditForm({ id }: { id: string }) {
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID");
  const [refundStatus, setRefundStatus] = useState<RefundStatus>("NONE");
  const [status, setStatus] = useState<OrderStatus>("INITIAL");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    fetch(`/api/admin/orders/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Không tìm thấy đơn hàng");
        if (!active) return;
        const ord: OrderDetail = data.item;
        setOrder(ord);
        setFullName(ord.fullName);
        setPhone(ord.phone);
        setEmail(ord.email || "");
        setNote(ord.note || "");
        setPaymentMethod(ord.paymentMethod);
        setPaymentStatus(ord.paymentStatus);
        setRefundStatus(ord.refundStatus || "NONE");
        setStatus(ord.status);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Không thể tải đơn hàng"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email: email.trim() || null,
          note: note || null,
          paymentMethod,
          paymentStatus,
          refundStatus,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể cập nhật đơn hàng");
        return;
      }
      setNotice(data.message || "Cập nhật đơn hàng thành công!");
      if (data.item) setOrder(data.item);
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-10 text-center text-sm text-[#667479]">
        Đang tải thông tin đơn hàng...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-10 text-center space-y-4">
        <p className="text-base font-bold text-[#B91C1C]">
          {error || "Đơn hàng không tồn tại"}
        </p>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#4880FF] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const allPassengers = order.items.flatMap((it) => {
    if (!Array.isArray(it.passengers)) return [];
    return (it.passengers as OrderPassengerInput[]).map((p) => ({
      ...p,
      tourName: it.name,
    }));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          Đơn hàng: {order.code}
        </h1>
      </div>

      {order.refundStatus === "REFUND_REQUIRED" && (
        <div className="rounded-xl bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#D97706]" />
          <div className="text-sm">
            <p className="font-bold">
              CẢNH BÁO HOÀN TIỀN (Late Webhook / Hết chỗ):
            </p>
            <p className="mt-0.5">
              Khách hàng đã chuyển khoản thanh toán sau khi đơn hàng bị hủy hoặc
              hết hạn giữ chỗ và tour không còn đủ chỗ để tự động duyệt lại. Vui
              lòng liên hệ hoàn tiền và cập nhật Trạng thái hoàn tiền sang{" "}
              <strong>Đã hoàn tiền</strong>.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 sm:p-8 space-y-6"
      >
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 font-semibold">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="order-fullname"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Tên khách hàng <span className="text-red-500">*</span>
            </label>
            <input
              id="order-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="order-phone"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              id="order-phone"
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="order-email"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Email khách hàng
            </label>
            <input
              id="order-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Chưa có email"
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="order-created-at"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Ngày đặt
            </label>
            <input
              id="order-created-at"
              type="text"
              readOnly
              value={formatDateTimeVN(order.createdAt)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#EAECEE] text-sm text-[#606060] cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="order-note"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Ghi chú
            </label>
            <textarea
              id="order-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú từ khách hàng..."
              className="w-full p-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="order-payment-method"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Phương thức thanh toán
            </label>
            <select
              id="order-payment-method"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="CASH">Tiền mặt</option>
              <option value="MOMO">Ví Momo</option>
              <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="order-payment-status"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Trạng thái thanh toán
            </label>
            <select
              id="order-payment-status"
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value as PaymentStatus)
              }
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PAID">Đã thanh toán</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="order-status"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Trạng thái đơn hàng
            </label>
            <select
              id="order-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="INITIAL">Khởi tạo</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="order-refund-status"
              className="block text-sm font-semibold text-[#606060] mb-2"
            >
              Trạng thái hoàn tiền
            </label>
            <select
              id="order-refund-status"
              value={refundStatus}
              onChange={(e) => setRefundStatus(e.target.value as RefundStatus)}
              className="w-full h-11 px-4 rounded-lg border border-[#D5D5D5] bg-[#F5F6FA] text-sm focus:outline-none focus:border-[#4880FF] focus:bg-white"
            >
              <option value="NONE">Không</option>
              <option value="REFUND_REQUIRED">Cần hoàn tiền</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
        </div>

        {/* Readonly Tour Items */}
        <div className="space-y-3 pt-2 border-t border-[#E0E0E0]">
          <h2 className="text-sm font-bold text-[#202224]">Danh sách tour</h2>
          <div className="space-y-3">
            {order.items.map((it) => (
              <div
                key={it.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-[#F5F6FA] border border-[#E0E0E0]"
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-white border border-[#E0E0E0] shrink-0">
                  {it.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.avatar}
                      alt={it.name}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 text-sm space-y-1">
                  <div className="font-bold text-[#202224]">
                    {it.name}
                    {it.departureCode && (
                      <span className="ml-2 text-xs font-semibold text-[#4880FF]">
                        ({it.departureCode})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#606060] flex flex-wrap gap-x-4 gap-y-1">
                    {it.quantityAdult > 0 && (
                      <span>
                        Người lớn: <b>{it.quantityAdult}</b> x{" "}
                        {formatCurrencyVND(it.priceNewAdult)}
                      </span>
                    )}
                    {it.quantityChild > 0 && (
                      <span>
                        Trẻ em: <b>{it.quantityChild}</b> x{" "}
                        {formatCurrencyVND(it.priceNewChild)}
                      </span>
                    )}
                    {it.quantityBaby > 0 && (
                      <span>
                        Em bé: <b>{it.quantityBaby}</b> x{" "}
                        {formatCurrencyVND(it.priceNewBaby)}
                      </span>
                    )}
                    {(it.singleRoomCount || 0) > 0 && (
                      <span>
                        Phụ thu phòng đơn: <b>{it.singleRoomCount}</b> x{" "}
                        {formatCurrencyVND(it.singleRoomSurcharge || 0)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#606060]">
                    Ngày khởi hành: <b>{formatDateVN(it.departureDate)}</b> •
                    Khởi hành tại: <b>{it.departureLocation}</b>
                  </div>
                  {(it.airline || it.flightOut) && (
                    <div className="text-xs text-[#4880FF] inline-flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5" />
                      <span>
                        {it.airline}
                        {it.flightOut ? ` • Đi: ${it.flightOut}` : ""}
                        {it.flightBack ? ` • Về: ${it.flightBack}` : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Passenger Manifest Table */}
        <div className="space-y-3 pt-2 border-t border-[#E0E0E0]">
          <h2 className="text-sm font-bold text-[#202224] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#4880FF]" />
            <span>Danh sách hành khách ({allPassengers.length})</span>
          </h2>
          {allPassengers.length === 0 ? (
            <p className="text-xs text-[#606060] italic">
              Đơn hàng này không có danh sách hành khách chi tiết.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F5F6FA] border-y border-[#E0E0E0] text-[#606060]">
                    <th className="py-2 px-3 font-semibold">STT</th>
                    <th className="py-2 px-3 font-semibold">Họ và tên</th>
                    <th className="py-2 px-3 font-semibold">Hạng vé</th>
                    <th className="py-2 px-3 font-semibold">Giới tính</th>
                    <th className="py-2 px-3 font-semibold">Ngày sinh</th>
                    <th className="py-2 px-3 font-semibold">CCCD / Hộ chiếu</th>
                    <th className="py-2 px-3 font-semibold">Tour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {allPassengers.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 tabular-nums text-[#606060]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#202224]">
                        {p.fullName}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#4880FF]">
                        {TIER_LABELS[p.tier] || p.tier}
                      </td>
                      <td className="py-2 px-3">
                        {GENDER_LABELS[p.gender] || p.gender}
                      </td>
                      <td className="py-2 px-3 tabular-nums">
                        {formatDateVN(p.birthDate)}
                      </td>
                      <td className="py-2 px-3 tabular-nums text-[#606060]">
                        {p.documentNumber || "—"}
                      </td>
                      <td className="py-2 px-3 text-[#606060] max-w-[200px] truncate">
                        {p.tourName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Readonly Payment Breakdown */}
        <div className="space-y-2 pt-2 border-t border-[#E0E0E0] text-sm">
          <h2 className="font-bold text-[#202224] mb-2">Thanh toán</h2>
          <div className="flex justify-between max-w-sm">
            <span className="text-[#606060]">Tổng tiền:</span>
            <span className="font-semibold">
              {formatCurrencyVND(order.subTotal)}
            </span>
          </div>
          <div className="flex justify-between max-w-sm">
            <span className="text-[#606060]">Giảm:</span>
            <span className="font-semibold">
              {formatCurrencyVND(order.discount)}
            </span>
          </div>
          {order.couponCode && (
            <div className="flex justify-between max-w-sm">
              <span className="text-[#606060]">Mã giảm:</span>
              <span className="font-bold text-[#4880FF]">
                {order.couponCode}
              </span>
            </div>
          )}
          <div className="flex justify-between max-w-sm pt-2 border-t border-[#E0E0E0] text-base">
            <span className="font-bold text-[#202224]">Thanh toán:</span>
            <span className="font-extrabold text-[#B91C1C]">
              {formatCurrencyVND(order.total)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-3">
          <button
            type="submit"
            disabled={submitting}
            className="h-12 px-10 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Cập nhật
          </button>

          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#4880FF] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách
          </Link>
        </div>
      </form>
    </div>
  );
}
