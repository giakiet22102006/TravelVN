import { NextRequest, NextResponse } from "next/server";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin("order_view");
    if (auth.error) return auth.error;

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || "";
    const paymentMethod = searchParams.get("paymentMethod") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.OrderWhereInput = { deleted: false };

    if (Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }
    if (Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      where.paymentMethod = paymentMethod as PaymentMethod;
    }
    if (Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
      where.paymentStatus = paymentStatus as PaymentStatus;
    }

    const createdAtFilter = buildDateRangeFilter(startDate, endDate);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/orders error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách đơn hàng" },
      { status: 500 }
    );
  }
}
