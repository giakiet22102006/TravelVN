import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_TOKEN_COOKIE,
  buildCookieOptions,
  computePasswordSig,
  getCurrentAdmin,
  hashPassword,
  isHttpsRequest,
  signAdminToken,
  verifyPassword,
} from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword) {
      return NextResponse.json(
        { message: "Vui lòng nhập mật khẩu hiện tại" },
        { status: 400 }
      );
    }

    const account = await prisma.adminAccount.findFirst({
      where: { id: admin.id, deleted: false },
      select: { password: true },
    });

    if (!account || !(await verifyPassword(currentPassword, account.password))) {
      return NextResponse.json(
        { message: "Mật khẩu hiện tại không chính xác" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải khác mật khẩu hiện tại" },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: "Mật khẩu xác nhận không khớp" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        password: hashedPassword,
        updatedById: admin.id,
      },
    });

    const pwdSig = await computePasswordSig(hashedPassword);
    const token = await signAdminToken({
      sub: admin.id,
      email: admin.email,
      roleId: admin.roleId,
      pwdSig,
    });

    const response = NextResponse.json({ message: "Đổi mật khẩu thành công!" });
    response.cookies.set(
      ADMIN_TOKEN_COOKIE,
      token,
      buildCookieOptions(7 * 24 * 60 * 60, isHttpsRequest(req))
    );
    return response;
  } catch (error) {
    console.error("PUT /api/admin/profile/change-password error:", error);
    return NextResponse.json(
      { message: "Lỗi khi đổi mật khẩu" },
      { status: 500 }
    );
  }
}
