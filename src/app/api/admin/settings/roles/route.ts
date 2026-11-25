import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  extractPermissionStrings,
  isSuperAdmin,
  requireAdmin,
} from "@/lib/auth";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

const VALID_PERMISSIONS = new Set(ALL_PERMISSION_KEYS);

function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  for (const val of input) {
    const key = String(val);
    if (VALID_PERMISSIONS.has(key)) {
      unique.add(key);
    }
  }
  return Array.from(unique);
}

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get("all") === "true";
    const auth = await requireAdmin(
      all ? ["role_view", "admin_create", "admin_edit"] : "role_view"
    );
    if (auth.error) return auth.error;

    const { searchParams } = req.nextUrl;

    if (all) {
      const items = await prisma.role.findMany({
        where: { deleted: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, description: true },
      });
      return NextResponse.json({ items });
    }

    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.RoleWhereInput = { deleted: false };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.role.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { accounts: true },
          },
        },
      }),
      prisma.role.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/settings/roles error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách nhóm quyền" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin("role_create");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { message: "Tên nhóm quyền không được để trống" },
        { status: 400 }
      );
    }

    const requestedPermissions = sanitizePermissions(body.permissions);
    if (!isSuperAdmin(admin)) {
      const callerPerms = new Set(
        extractPermissionStrings(admin.role?.permissions)
      );
      const unauthorized = requestedPermissions.filter(
        (key) => !callerPerms.has(key)
      );
      if (unauthorized.length > 0) {
        return NextResponse.json(
          {
            message:
              "Bạn không thể cấp quyền mà tài khoản của bạn không sở hữu",
          },
          { status: 403 }
        );
      }
    }

    const item = await prisma.role.create({
      data: {
        name,
        description: body.description ? String(body.description).trim() : null,
        permissions: requestedPermissions,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    return NextResponse.json(
      { message: "Tạo nhóm quyền thành công!", item },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/settings/roles error:", error);
    return NextResponse.json(
      { message: "Lỗi tạo nhóm quyền" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin("role_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const body = await req.json();
    const action = String(body.action || "");
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn ít nhất một nhóm quyền" },
        { status: 400 }
      );
    }

    if (action === "DELETE") {
      if (ids.includes("role-admin") || (admin.roleId && ids.includes(admin.roleId))) {
        return NextResponse.json(
          { message: "Không thể xóa nhóm quyền Quản trị viên hệ thống hoặc nhóm quyền bạn đang sử dụng" },
          { status: 400 }
        );
      }

      const assignedCount = await prisma.adminAccount.count({
        where: { roleId: { in: ids }, deleted: false },
      });
      if (assignedCount > 0) {
        return NextResponse.json(
          { message: `Không thể xóa vì đang có ${assignedCount} tài khoản quản trị sử dụng nhóm quyền này` },
          { status: 400 }
        );
      }

      await prisma.role.updateMany({
        where: { id: { in: ids } },
        data: { deleted: true, updatedById: admin.id },
      });
      return NextResponse.json({ message: "Đã xóa các nhóm quyền đã chọn!" });
    }

    return NextResponse.json(
      { message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/settings/roles error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
