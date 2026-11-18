import { NextRequest, NextResponse } from "next/server";
import { ContactStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin("contact_view");
    if (auth.error) return auth.error;

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.ContactWhereInput = { deleted: false };

    if (status === ContactStatus.NEW || status === ContactStatus.PROCESSED) {
      where.status = status;
    }

    const createdAtFilter = buildDateRangeFilter(startDate, endDate);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/contacts error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách liên hệ" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    const auth = await requireAdmin(
      action === "DELETE" ? "contact_delete" : "contact_edit"
    );
    if (auth.error) return auth.error;

    if (ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn ít nhất một email liên hệ" },
        { status: 400 }
      );
    }

    if (action === "MARK_PROCESSED" || action === "MARK_NEW") {
      const status =
        action === "MARK_PROCESSED"
          ? ContactStatus.PROCESSED
          : ContactStatus.NEW;
      await prisma.contact.updateMany({
        where: { id: { in: ids }, deleted: false },
        data: { status },
      });
      return NextResponse.json({
        message:
          action === "MARK_PROCESSED"
            ? "Đã đánh dấu đã liên hệ!"
            : "Đã chuyển về trạng thái chưa xử lý!",
      });
    }

    if (action === "DELETE") {
      await prisma.contact.updateMany({
        where: { id: { in: ids } },
        data: { deleted: true },
      });
      return NextResponse.json({ message: "Đã xóa các liên hệ đã chọn!" });
    }

    return NextResponse.json(
      { message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/contacts error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
