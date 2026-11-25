"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
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
import { useAdminPermissions } from "@/components/admin/AdminShell";
import { AdminForbiddenCard } from "@/components/admin/AdminForbiddenCard";

interface ChartPoint {
  day: number;
  label: string;
  revenue: number;
  orderCount: number;
}

interface OrderItemSummary {
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

interface RecentOrder {
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
  items: OrderItemSummary[];
}

interface DashboardData {
  selectedMonth: string;
  monthOptions: string[];
  kpis: {
    userCount: number;
    orderCount: number;
    totalRevenue: number;
    monthRevenue: number;
  };
  chartData: ChartPoint[];
  recentOrders: RecentOrder[];
}

function formatMonthDisplay(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return m && y ? `Tháng ${m}/${y}` : monthKey;
}

export default function AdminDashboardPage() {
  const { hasPermission } = useAdminPermissions();
  const canViewDashboard = hasPermission("dashboard_view");
  const canViewTrash = hasPermission("tour_trash");
  const canViewOrders = hasPermission("order_view");
  const canEditOrders = hasPermission("order_edit");

  const [requestedMonth, setRequestedMonth] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const qs = requestedMonth
        ? `?month=${encodeURIComponent(requestedMonth)}`
        : "";
      const res = await fetch(`/api/admin/dashboard${qs}`);
      const json = await res.json().catch(() => null);

      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }

      if (!res.ok || !json || !json.kpis) {
        setError(
          (json && typeof json.message === "string" && json.message) ||
            "Không thể tải dữ liệu Tổng quan."
        );
        return;
      }

      setData(json as DashboardData);
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [requestedMonth]);

  useEffect(() => {
    if (!canViewDashboard) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [canViewDashboard, loadDashboard, reloadTick]);

  if (forbidden) {
    return (
      <AdminForbiddenCard
        title="Bạn không có quyền xem trang Tổng quan"
        description="Tài khoản quản trị của bạn chưa được cấp quyền xem báo cáo Tổng quan. Vui lòng sử dụng menu bên trái hoặc liên hệ Quản trị viên."
      />
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[360px] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#B91C1C] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-[#202224]">
            Tải trang Tổng quan thất bại
          </h1>
          <p className="text-sm text-[#606060]">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => setReloadTick((n) => n + 1)}
          className="h-10 px-5 rounded-xl bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Tải lại
        </button>
      </div>
    );
  }

  const activeMonth = requestedMonth || data?.selectedMonth || "";
  const points = data?.chartData || [];
  const maxRevenue = Math.max(
    10_000_000,
    ...points.map((p) => p.revenue),
    1
  );
  const chartW = 920;
  const chartH = 260;
  const padL = 62;
  const padR = 20;
  const padT = 22;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const coords = points.map((pt, idx) => {
    const x =
      points.length > 1
        ? padL + (idx / (points.length - 1)) * plotW
        : padL + plotW / 2;
    const y = padT + plotH - (pt.revenue / maxRevenue) * plotH;
    return { x, y, pt };
  });

  const linePath =
    coords.length > 0
      ? coords
          .map(
            (c, idx) =>
              `${idx === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`
          )
          .join(" ")
      : "";
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} L${coords[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : "";

  const hovered = hoveredIdx !== null ? coords[hoveredIdx] : null;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-[32px] font-bold text-[#202224]">
          Tổng quan
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {canViewTrash && (
            <Link
              href="/admin/tours/trash"
              className="px-4 py-2 rounded-lg bg-white border border-[#D5D5D5] text-sm font-semibold text-[#B91C1C] hover:border-[#B91C1C] inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Thùng rác tour
            </Link>
          )}
          {canViewOrders && (
            <Link
              href="/admin/orders"
              className="px-4 py-2 rounded-lg bg-[#4880FF] text-white text-sm font-semibold hover:bg-[#3a6ce0]"
            >
              Quản lý đơn hàng
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="text-xs font-bold underline shrink-0"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#606060]">Người dùng</p>
            <p className="text-[28px] font-extrabold text-[#202224] mt-1.5">
              {data ? data.kpis.userCount.toLocaleString("vi-VN") : "..."}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#8280FF]/15 text-[#8280FF] flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#606060]">Đơn hàng</p>
            <p className="text-[28px] font-extrabold text-[#202224] mt-1.5">
              {data ? data.kpis.orderCount.toLocaleString("vi-VN") : "..."}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#FEC53D]/20 text-[#B45309] flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#606060]">Doanh thu</p>
            <p className="text-[26px] font-extrabold text-[#202224] mt-1.5">
              {data ? formatCurrencyVND(data.kpis.totalRevenue) : "..."}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#4AD991]/20 text-[#0F766E] flex items-center justify-center">
            <TrendingUp className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Revenue Area/Line Chart Card */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#202224]">
              Biểu đồ doanh thu
            </h2>
            {data && (
              <p className="text-xs font-semibold text-[#606060] mt-1">
                Doanh thu thực tế trong tháng:{" "}
                <span className="text-[#4880FF]">
                  {formatCurrencyVND(data.kpis.monthRevenue)}
                </span>
              </p>
            )}
          </div>

          <select
            aria-label="Chọn tháng xem doanh thu"
            value={activeMonth}
            onChange={(e) => {
              const val = e.target.value;
              if (val !== activeMonth) {
                setRequestedMonth(val);
              }
            }}
            className="h-10 px-3.5 rounded-lg border border-[#D5D5D5] bg-[#FCFDFD] text-sm font-semibold text-[#202224] focus:outline-none focus:border-[#4880FF]"
          >
            {(data?.monthOptions || (activeMonth ? [activeMonth] : [])).map(
              (m) => (
                <option key={m} value={m}>
                  {formatMonthDisplay(m)}
                </option>
              )
            )}
          </select>
        </div>

        {loading && !data ? (
          <div className="h-[306px] flex items-center justify-center text-sm text-[#667479]">
            Đang tải biểu đồ doanh thu...
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            {/* Fixed-height hover readout container prevents layout shift (0px CLS) */}
            <div className="min-h-[36px] mb-2 flex items-center">
              {hovered ? (
                <div className="inline-flex flex-wrap items-center gap-3 px-3.5 py-1.5 rounded-lg bg-[#4880FF] text-white text-xs font-bold shadow-sm">
                  <span>Ngày {hovered.pt.label}</span>
                  <span>•</span>
                  <span>
                    Doanh thu: {formatCurrencyVND(hovered.pt.revenue)} (
                    {hovered.pt.orderCount} đơn)
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#667479]">
                  Di chuột vào các điểm trên biểu đồ để xem doanh thu chi tiết
                  theo ngày.
                </span>
              )}
            </div>

            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full min-w-[640px] h-[270px] select-none"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient
                  id="revenueAreaGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#4379EE" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#4379EE" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {yTicks.map((ratio) => {
                const yVal = padT + plotH - ratio * plotH;
                const labelVal = Math.round((maxRevenue * ratio) / 1_000_000);
                return (
                  <g key={ratio}>
                    <line
                      x1={padL}
                      y1={yVal}
                      x2={chartW - padR}
                      y2={yVal}
                      stroke="#EAEAEA"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padL - 10}
                      y={yVal + 4}
                      textAnchor="end"
                      fill="#667479"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {labelVal === 0 ? "0đ" : `${labelVal}tr`}
                    </text>
                  </g>
                );
              })}

              {areaPath && (
                <path d={areaPath} fill="url(#revenueAreaGrad)" />
              )}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#4379EE"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {hovered && (
                <line
                  x1={hovered.x}
                  y1={padT}
                  x2={hovered.x}
                  y2={padT + plotH}
                  stroke="#4880FF"
                  strokeDasharray="3 3"
                  strokeOpacity="0.6"
                />
              )}

              {coords.map((c, idx) => {
                const isHovered = hoveredIdx === idx;
                const showXTick =
                  idx === 0 || idx === coords.length - 1 || idx % 5 === 0;
                return (
                  <g key={c.pt.day}>
                    {showXTick && (
                      <text
                        x={c.x}
                        y={chartH - 10}
                        textAnchor="middle"
                        fill="#667479"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {c.pt.label}
                      </text>
                    )}

                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isHovered ? 6 : 3.5}
                      fill={isHovered ? "#FFFFFF" : "#4379EE"}
                      stroke="#4379EE"
                      strokeWidth={isHovered ? 3 : 1.5}
                    />

                    <rect
                      x={c.x - plotW / Math.max(points.length, 1) / 2}
                      y={padT}
                      width={plotW / Math.max(points.length, 1)}
                      height={plotH}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-[14px] border border-[#E0E0E0] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E0E0E0] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#202224]">Đơn hàng mới</h2>
          {canViewOrders && (
            <Link
              href="/admin/orders"
              className="text-sm font-bold text-[#4880FF] hover:underline"
            >
              Xem tất cả
            </Link>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="bg-[#FCFDFD] border-b border-[#E0E0E0] text-xs font-extrabold uppercase text-[#202224]">
                <th className="py-4 px-4">Mã</th>
                <th className="py-4 px-4">Thông tin khách</th>
                <th className="py-4 px-4">Danh sách tour</th>
                <th className="py-4 px-4">Thanh toán</th>
                <th className="py-4 px-4 text-center">Trạng thái</th>
                <th className="py-4 px-4 text-right">Ngày đặt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0] text-sm">
              {!data || data.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#667479]">
                    Chưa có đơn hàng nào.
                  </td>
                </tr>
              ) : (
                data.recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#F5F6FA]/60 align-top">
                    <td className="py-4 px-4">
                      {canEditOrders ? (
                        <Link
                          href={`/admin/orders/edit/${ord.id}`}
                          className="font-bold text-[#4880FF] hover:underline"
                        >
                          {ord.code}
                        </Link>
                      ) : (
                        <span className="font-bold text-[#202224]">
                          {ord.code}
                        </span>
                      )}
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
                            <div className="font-bold text-[#202224] line-clamp-1 max-w-[240px]">
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
                      <div>
                        Tổng tiền: {formatCurrencyVND(ord.subTotal)}
                      </div>
                      <div>Giảm: {formatCurrencyVND(ord.discount)}</div>
                      {ord.couponCode && (
                        <div>
                          Mã giảm:{" "}
                          <span className="font-bold">{ord.couponCode}</span>
                        </div>
                      )}
                      <div>
                        Thanh toán:{" "}
                        <span className="font-extrabold text-[#B91C1C]">
                          {formatCurrencyVND(ord.total)}
                        </span>
                      </div>
                      <div>
                        PTTT: {PAYMENT_METHOD_LABELS[ord.paymentMethod]}
                      </div>
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
                    <td className="py-4 px-4 text-right text-xs font-semibold text-[#606060] whitespace-nowrap">
                      {formatDateTimeVN(ord.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
