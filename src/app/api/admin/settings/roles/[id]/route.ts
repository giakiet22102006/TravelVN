import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(["role_view", "role_edit"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const item = await prisma.role.findFirst({
      where: { id, deleted: false },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy nhóm quyền" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/settings/roles/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin nhóm quyền" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("role_edit");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    const existing = await prisma.role.findFirst({
      where: { id, deleted: false },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy nhóm quyền" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { message: "Tên nhóm quyền không được để trống" },
        { status: 400 }
      );
    }

    const item = await prisma.role.update({
      where: { id },
      data: {
        name,
        description: body.description ? String(body.description).trim() : null,
        permissions: sanitizePermissions(body.permissions),
        updatedById: admin.id,
      },
    });

    return NextResponse.json({
      message: "Cập nhật nhóm quyền thành công!",
      item,
    });
  } catch (error) {
    console.error("PUT /api/admin/settings/roles/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật nhóm quyền" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("role_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    if (id === "role-admin" || id === admin.roleId) {
      return NextResponse.json(
        { message: "Không thể xóa nhóm quyền Quản trị viên hệ thống hoặc nhóm quyền bạn đang sử dụng" },
        { status: 400 }
      );
    }

    const assignedCount = await prisma.adminAccount.count({
      where: { roleId: id, deleted: false },
    });
    if (assignedCount > 0) {
      return NextResponse.json(
        { message: `Không thể xóa vì đang có ${assignedCount} tài khoản quản trị sử dụng nhóm quyền này` },
        { status: 400 }
      );
    }
    const existing = await prisma.role.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy nhóm quyền" },
        { status: 404 }
      );
    }

    await prisma.role.update({
      where: { id },
      data: { deleted: true, updatedById: admin.id },
    });

    return NextResponse.json({ message: "Xóa nhóm quyền thành công!" });
  } catch (error) {
    console.error("DELETE /api/admin/settings/roles/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa nhóm quyền" },
      { status: 500 }
    );
  }
}
