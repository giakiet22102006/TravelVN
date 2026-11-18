"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { formatCurrencyVND, formatDateTimeVN } from "@/lib/format";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TEXT_CLASSES,
} from "@/lib/permissions";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

interface OrderItemRow {
  id: string;
  name: string;
  avatar: string | null;
  quantityAdult: number;
  priceNewAdult: number;
  quantityChild: number;
  priceNewChild: number;
  quantityBaby: number;
  priceNewBaby: number;
}

interface OrderRow {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  note: string | null;
  subTotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemRow[];
}

export default function AdminOrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set("status", status);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    status,
    paymentMethod,
    paymentStatus,
    startDate,
    endDate,
    debouncedSearch,
  ]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function resetFilters() {
    setStatus("");
    setPaymentMethod("");
    setPaymentStatus("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Bạn có chắc muốn xóa đơn hàng "${code}"?`)) return;
    const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setNotice(data.message || "Xóa đơn hàng thành công!");
      fetchOrders();
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(total, page * limit);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
        Quản lý đơn hàng
      </h1>

      {notice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter Bar (Figma #9:2) */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#202224] pr-2">
          <Filter className="w-4 h-4" />
          <span>Bộ lọc</span>
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Trạng thái</option>
          <option value="INITIAL">Khởi tạo</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm"
          />
          <span className="text-sm text-[#667479]">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-lg border border-[#D5D5D5] text-sm"
          />
        </div>

        <select
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Phương thức thanh toán</option>
          <option value="CASH">Tiền mặt</option>
          <option value="MOMO">Ví Momo</option>
          <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm font-semibold"
        >
          <option value="">Trạng thái thanh toán</option>
          <option value="UNPAID">Chưa thanh toán</option>
          <option value="PAID">Đã thanh toán</option>
        </select>

        <button
          type="button"
          onClick={resetFilters}
          className="h-10 px-3 rounded-lg text-sm font-bold text-[#EA0234] hover:bg-red-50 inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Xóa bộ lọc
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#99A2A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm mã đơn, họ tên, SĐT..."
            className="h-11 w-72 sm:w-80 pl-10 pr-4 rounded-[14px] bg-white border border-[#E0E0E0] text-sm focus:outline-none focus:border-[#4880FF]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left border-collapse">
          <thead>
            <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-extrabold uppercase text-[#202224]">
              <th className="py-4 px-4">Mã</th>
              <th className="py-4 px-4">Thông tin khách</th>
              <th className="py-4 px-4">Danh sách tour</th>
              <th className="py-4 px-4">Thanh toán</th>
              <th className="py-4 px-4 text-center">Trạng thái</th>
              <th className="py-4 px-4">Ngày đặt</th>
              <th className="py-4 px-4 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#667479]">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#667479]">
                  Không có đơn hàng nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((ord) => (
                <tr key={ord.id} className="hover:bg-[#F5F6FA]/60 align-top">
                  <td className="py-4 px-4 font-bold text-[#4880FF]">
                    {ord.code}
                  </td>
                  <td className="py-4 px-4 text-xs space-y-1 text-[#202224]">
                    <div>
                      <span className="text-[#667479]">Họ tên: </span>
                      <span className="font-bold">{ord.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[#667479]">SĐT: </span>
                      <span className="font-semibold">{ord.phone}</span>
                    </div>
                    {ord.note && (
                      <div>
                        <span className="text-[#667479]">Ghi chú: </span>
                        <span>{ord.note}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 space-y-2.5">
                    {ord.items.map((it) => (
                      <div key={it.id} className="flex items-start gap-2.5">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F5F6FA] border border-[#E0E0E0] shrink-0">
                          {it.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.avatar}
                              alt={it.name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="text-xs space-y-0.5">
                          <div className="font-bold text-[#202224] line-clamp-1 max-w-[230px]">
                            {it.name}
                          </div>
                          {it.quantityAdult > 0 && (
                            <div className="text-[#606060]">
                              Người lớn: {it.quantityAdult} x{" "}
                              {formatCurrencyVND(it.priceNewAdult)}
                            </div>
                          )}
                          {it.quantityChild > 0 && (
                            <div className="text-[#606060]">
                              Trẻ em: {it.quantityChild} x{" "}
                              {formatCurrencyVND(it.priceNewChild)}
                            </div>
                          )}
                          {it.quantityBaby > 0 && (
                            <div className="text-[#606060]">
                              Em bé: {it.quantityBaby} x{" "}
                              {formatCurrencyVND(it.priceNewBaby)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </td>
                  <td className="py-4 px-4 text-xs space-y-1">
                    <div>Tổng tiền: {formatCurrencyVND(ord.subTotal)}</div>
                    <div>Giảm: {formatCurrencyVND(ord.discount)}</div>
                    {ord.couponCode && (
                      <div>
                        Mã giảm:{" "}
                        <span className="font-bold">{ord.couponCode}</span>
                      </div>
                    )}
                    <div>
                      Thanh toán:{" "}
                      <span className="font-extrabold text-[#EF3826]">
                        {formatCurrencyVND(ord.total)}
                      </span>
                    </div>
                    <div>PTTT: {PAYMENT_METHOD_LABELS[ord.paymentMethod]}</div>
                    <div>
                      TTTT:{" "}
                      <span
                        className={
                          PAYMENT_STATUS_TEXT_CLASSES[ord.paymentStatus]
                        }
                      >
                        {PAYMENT_STATUS_LABELS[ord.paymentStatus]}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-md text-xs font-bold ${
                        ORDER_STATUS_BADGE_CLASSES[ord.status]
                      }`}
                    >
                      {ORDER_STATUS_LABELS[ord.status]}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-semibold text-[#606060] whitespace-nowrap">
                    {formatDateTimeVN(ord.createdAt)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="inline-flex items-center rounded-lg border border-[#D5D5D5] bg-[#FAFBFD] overflow-hidden">
                      <Link
                        href={`/admin/orders/edit/${ord.id}`}
                        className="p-2 hover:bg-[#4880FF]/10 text-[#202224] hover:text-[#4880FF]"
                        title="Chỉnh sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(ord.id, ord.code)}
                        className="p-2 border-l border-[#D5D5D5] hover:bg-red-50 text-[#EF3826]"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#606060] font-semibold">
        <div>
          Hiển thị {startRecord} - {endRecord} của {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-9 px-3 rounded-lg bg-white border border-[#D5D5D5] hover:border-[#4880FF] disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Trước
          </button>
          <span className="px-2">
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-9 px-3 rounded-lg bg-white border border-[#D5D5D5] hover:border-[#4880FF] disabled:opacity-40 inline-flex items-center gap-1"
          >
            Sau
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
