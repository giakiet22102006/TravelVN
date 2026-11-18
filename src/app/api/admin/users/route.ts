import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/admin-api";
import { USER_PUBLIC_SELECT } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.UserWhereInput = { deleted: false };

    if (status === "ACTIVE" || status === "INACTIVE" || status === "INITIAL") {
      where.status = status;
    }

    const createdAtFilter = buildDateRangeFilter(startDate, endDate);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách người dùng" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!fullName || !email) {
      return NextResponse.json(
        { message: "Họ tên và Email không được để trống" },
        { status: 400 }
      );
    }

    const status: RecordStatus =
      body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deleted) {
      return NextResponse.json(
        { message: "Email người dùng đã tồn tại" },
        { status: 409 }
      );
    }

    const payload = {
      fullName,
      email,
      phone: body.phone ? String(body.phone).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      avatar: body.avatar ? String(body.avatar).trim() : null,
      status,
      deleted: false,
    };

    const item = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: payload,
          select: USER_PUBLIC_SELECT,
        })
      : await prisma.user.create({
          data: payload,
          select: USER_PUBLIC_SELECT,
        });

    return NextResponse.json(
      { message: "Tạo người dùng thành công!", item },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { message: "Lỗi tạo người dùng" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const action = String(body.action || "");
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn ít nhất một người dùng" },
        { status: 400 }
      );
    }

    if (action === "ACTIVE" || action === "INACTIVE") {
      await prisma.user.updateMany({
        where: { id: { in: ids }, deleted: false },
        data: { status: action },
      });
      return NextResponse.json({ message: "Cập nhật trạng thái thành công!" });
    }

    if (action === "DELETE") {
      await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { deleted: true },
      });
      return NextResponse.json({ message: "Đã xóa các người dùng đã chọn!" });
    }

    return NextResponse.json(
      { message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
