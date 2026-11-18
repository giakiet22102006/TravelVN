import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function getVietnamDateParts(date: Date = new Date()) {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: vn.getUTCFullYear(),
    monthIndex: vn.getUTCMonth(),
    day: vn.getUTCDate(),
  };
}

function toMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function resolveTargetMonth(rawMonth: string | null): {
  monthKey: string;
  year: number;
  monthIndex: number;
} {
  const vnNow = getVietnamDateParts();

  if (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) {
    const [yStr, mStr] = rawMonth.split("-");
    const year = Number(yStr);
    const monthNum = Number(mStr);
    if (year >= 2020 && year <= 2100 && monthNum >= 1 && monthNum <= 12) {
      return {
        monthKey: rawMonth,
        year,
        monthIndex: monthNum - 1,
      };
    }
  }

  return {
    monthKey: toMonthKey(vnNow.year, vnNow.monthIndex),
    year: vnNow.year,
    monthIndex: vnNow.monthIndex,
  };
}

/**
 * Aggregates real Admin KPIs, Vietnam-timezone daily revenue series for the
 * selected month, and recent non-deleted orders from PostgreSQL.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin("dashboard_view");
    if (auth.error) return auth.error;

    const { monthKey, year, monthIndex } = resolveTargetMonth(
      req.nextUrl.searchParams.get("month")
    );
    const startOfMonth = new Date(
      Date.UTC(year, monthIndex, 1, 0, 0, 0, 0) - VN_OFFSET_MS
    );
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const endOfMonth = new Date(
      Date.UTC(year, monthIndex, daysInMonth, 23, 59, 59, 999) - VN_OFFSET_MS
    );

    const [
      userCount,
      orderCount,
      revenueAgg,
      monthOrders,
      recentOrders,
      allOrderDates,
    ] = await Promise.all([
      prisma.user.count({ where: { deleted: false } }),
      prisma.order.count({ where: { deleted: false } }),
      prisma.order.aggregate({
        where: { deleted: false, status: { not: "CANCELLED" } },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: {
          deleted: false,
          status: { not: "CANCELLED" },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { total: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { deleted: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
      prisma.order.findMany({
        where: { deleted: false },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    const dailyTotals = new Map<number, { revenue: number; count: number }>();
    let monthRevenue = 0;

    for (const ord of monthOrders) {
      const { day } = getVietnamDateParts(ord.createdAt);
      const prev = dailyTotals.get(day) || { revenue: 0, count: 0 };
      prev.revenue += ord.total;
      prev.count += 1;
      dailyTotals.set(day, prev);
      monthRevenue += ord.total;
    }

    const chartData = Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      const actual = dailyTotals.get(day) || { revenue: 0, count: 0 };
      return {
        day,
        label: `${String(day).padStart(2, "0")}/${String(monthIndex + 1).padStart(2, "0")}`,
        revenue: actual.revenue,
        orderCount: actual.count,
      };
    });

    const vnNow = getVietnamDateParts();
    const currentMonthKey = toMonthKey(vnNow.year, vnNow.monthIndex);
    const prevDate = new Date(Date.UTC(vnNow.year, vnNow.monthIndex - 1, 1));
    const prevMonthKey = toMonthKey(
      prevDate.getUTCFullYear(),
      prevDate.getUTCMonth()
    );

    const monthOptionsSet = new Set<string>([
      currentMonthKey,
      prevMonthKey,
      monthKey,
    ]);
    for (const row of allOrderDates) {
      const parts = getVietnamDateParts(row.createdAt);
      monthOptionsSet.add(toMonthKey(parts.year, parts.monthIndex));
    }

    return NextResponse.json({
      selectedMonth: monthKey,
      monthOptions: Array.from(monthOptionsSet).sort().reverse(),
      kpis: {
        userCount,
        orderCount,
        totalRevenue: revenueAgg._sum.total ?? 0,
        monthRevenue,
      },
      chartData,
      recentOrders,
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard error:", error);
    return NextResponse.json(
      { message: "Lỗi tải dữ liệu tổng quan" },
      { status: 500 }
    );
  }
}
