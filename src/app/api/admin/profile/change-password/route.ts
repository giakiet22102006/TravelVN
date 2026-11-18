import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, hashPassword } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải có ít nhất 6 ký tự" },
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

    return NextResponse.json({ message: "Đổi mật khẩu thành công!" });
  } catch (error) {
    console.error("PUT /api/admin/profile/change-password error:", error);
    return NextResponse.json(
      { message: "Lỗi khi đổi mật khẩu" },
      { status: 500 }
    );
  }
}
