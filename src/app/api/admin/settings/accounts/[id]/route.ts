import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { ADMIN_ACCOUNT_PUBLIC_SELECT } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(["admin_view", "admin_edit"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const item = await prisma.adminAccount.findFirst({
      where: { id, deleted: false },
      select: ADMIN_ACCOUNT_PUBLIC_SELECT,
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản quản trị" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/settings/accounts/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin tài khoản" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("admin_edit");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    const existing = await prisma.adminAccount.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản quản trị" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const rawPassword = String(body.password || "");

    if (!fullName || !email) {
      return NextResponse.json(
        { message: "Họ tên và Email không được để trống" },
        { status: 400 }
      );
    }

    const emailTaken = await prisma.adminAccount.findFirst({
      where: { email, NOT: { id } },
      select: { id: true },
    });
    if (emailTaken) {
      return NextResponse.json(
        { message: "Email đã được sử dụng bởi tài khoản khác" },
        { status: 409 }
      );
    }

    if (rawPassword && rawPassword.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    const status: RecordStatus = Object.values(RecordStatus).includes(body.status)
      ? (body.status as RecordStatus)
      : RecordStatus.ACTIVE;

    const updateData: {
      fullName: string;
      email: string;
      phone: string | null;
      positionCompany: string | null;
      roleId: string | null;
      avatar: string | null;
      status: RecordStatus;
      updatedById: string;
      password?: string;
    } = {
      fullName,
      email,
      phone: body.phone ? String(body.phone).trim() : null,
      positionCompany: body.positionCompany
        ? String(body.positionCompany).trim()
        : null,
      roleId: body.roleId || null,
      avatar: body.avatar ? String(body.avatar).trim() : null,
      status,
      updatedById: admin.id,
    };

    if (rawPassword) {
      updateData.password = await hashPassword(rawPassword);
    }

    const item = await prisma.adminAccount.update({
      where: { id },
      data: updateData,
      select: ADMIN_ACCOUNT_PUBLIC_SELECT,
    });

    return NextResponse.json({
      message: "Cập nhật tài khoản quản trị thành công!",
      item,
    });
  } catch (error) {
    console.error("PUT /api/admin/settings/accounts/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật tài khoản quản trị" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("admin_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    if (id === admin.id) {
      return NextResponse.json(
        { message: "Không thể tự xóa tài khoản đang đăng nhập" },
        { status: 400 }
      );
    }

    const existing = await prisma.adminAccount.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản quản trị" },
        { status: 404 }
      );
    }

    await prisma.adminAccount.update({
      where: { id },
      data: { deleted: true, updatedById: admin.id },
    });

    return NextResponse.json({ message: "Xóa tài khoản quản trị thành công!" });
  } catch (error) {
    console.error("DELETE /api/admin/settings/accounts/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa tài khoản quản trị" },
      { status: 500 }
    );
  }
}
