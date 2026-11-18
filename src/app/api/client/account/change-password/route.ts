import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getCurrentUser } from "@/lib/client-auth";

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    const record = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, password: true },
    });

    if (!record) {
      return NextResponse.json(
        { message: "Không tìm thấy tài khoản" },
        { status: 404 }
      );
    }

    if (record.password) {
      if (!currentPassword) {
        return NextResponse.json(
          { message: "Vui lòng nhập mật khẩu hiện tại" },
          { status: 400 }
        );
      }
      const isMatch = await verifyPassword(currentPassword, record.password);
      if (!isMatch) {
        return NextResponse.json(
          { message: "Mật khẩu hiện tại không chính xác" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { password: passwordHash },
    });

    return NextResponse.json({
      message: record.password
        ? "Đổi mật khẩu thành công!"
        : "Thiết lập mật khẩu đăng nhập thành công!",
    });
  } catch (error) {
    console.error("PUT /api/client/account/change-password error:", error);
    return NextResponse.json(
      { message: "Lỗi đổi mật khẩu" },
      { status: 500 }
    );
  }
}
