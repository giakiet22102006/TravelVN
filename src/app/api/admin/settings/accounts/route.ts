import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, hashPassword } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/admin-api";
import { ADMIN_ACCOUNT_PUBLIC_SELECT } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || "";
    const roleId = searchParams.get("roleId") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.AdminAccountWhereInput = { deleted: false };

    if (Object.values(RecordStatus).includes(status as RecordStatus)) {
      where.status = status as RecordStatus;
    }
    if (roleId) {
      where.roleId = roleId;
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
        { positionCompany: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total, roles] = await Promise.all([
      prisma.adminAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: ADMIN_ACCOUNT_PUBLIC_SELECT,
      }),
      prisma.adminAccount.count({ where }),
      prisma.role.findMany({
        where: { deleted: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ items, total, page, limit, roles });
  } catch (error) {
    console.error("GET /api/admin/settings/accounts error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách tài khoản quản trị" },
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
    const password = String(body.password || "");

    if (!fullName || !email) {
      return NextResponse.json(
        { message: "Họ tên và Email không được để trống" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    const existing = await prisma.adminAccount.findUnique({
      where: { email },
      select: { id: true, deleted: true },
    });

    if (existing && !existing.deleted) {
      return NextResponse.json(
        { message: "Email tài khoản đã tồn tại" },
        { status: 409 }
      );
    }

    const status: RecordStatus = Object.values(RecordStatus).includes(body.status)
      ? (body.status as RecordStatus)
      : RecordStatus.ACTIVE;

    const hashedPassword = await hashPassword(password);
    const dataPayload = {
      fullName,
      email,
      phone: body.phone ? String(body.phone).trim() : null,
      positionCompany: body.positionCompany
        ? String(body.positionCompany).trim()
        : null,
      roleId: body.roleId || null,
      avatar: body.avatar ? String(body.avatar).trim() : null,
      status,
      password: hashedPassword,
      deleted: false,
      updatedById: admin.id,
    };

    const item = existing
      ? await prisma.adminAccount.update({
          where: { id: existing.id },
          data: dataPayload,
          select: ADMIN_ACCOUNT_PUBLIC_SELECT,
        })
      : await prisma.adminAccount.create({
          data: {
            ...dataPayload,
            createdById: admin.id,
          },
          select: ADMIN_ACCOUNT_PUBLIC_SELECT,
        });

    return NextResponse.json(
      { message: "Tạo tài khoản quản trị thành công!", item },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/settings/accounts error:", error);
    return NextResponse.json(
      { message: "Lỗi tạo tài khoản quản trị" },
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
        { message: "Vui lòng chọn ít nhất một tài khoản" },
        { status: 400 }
      );
    }

    if (action === "ACTIVE" || action === "INACTIVE" || action === "INITIAL") {
      await prisma.adminAccount.updateMany({
        where: { id: { in: ids }, deleted: false },
        data: { status: action, updatedById: admin.id },
      });
      return NextResponse.json({ message: "Cập nhật trạng thái thành công!" });
    }

    if (action === "DELETE") {
      const targetIds = ids.filter((id) => id !== admin.id);
      if (targetIds.length === 0) {
        return NextResponse.json(
          { message: "Không thể tự xóa tài khoản đang đăng nhập" },
          { status: 400 }
        );
      }

      await prisma.adminAccount.updateMany({
        where: { id: { in: targetIds } },
        data: { deleted: true, updatedById: admin.id },
      });
      return NextResponse.json({ message: "Đã xóa các tài khoản đã chọn!" });
    }

    return NextResponse.json(
      { message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/settings/accounts error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
