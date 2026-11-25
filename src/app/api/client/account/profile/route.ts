import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLIENT_USER_SELECT,
  getCurrentUser,
  toClientUserPublic,
} from "@/lib/client-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu cập nhật hồ sơ không hợp lệ" },
          { status: 400 }
        );
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { message: "Payload JSON không hợp lệ" },
        { status: 400 }
      );
    }
    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const avatar = body.avatar ? String(body.avatar).trim() : null;

    if (!fullName) {
      return NextResponse.json(
        { message: "Họ và tên không được để trống" },
        { status: 400 }
      );
    }

    if (phone) {
      const normalizedPhone = phone.replace(/[\s.-]/g, "");
      if (!/^(\+84|0)[0-9]{8,10}$/.test(normalizedPhone)) {
        return NextResponse.json(
          { message: "Số điện thoại không hợp lệ (ví dụ: 0912345678)" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        fullName,
        phone: phone || null,
        address: address || null,
        avatar,
      },
      select: {
        ...CLIENT_USER_SELECT,
        password: true,
      },
    });

    return NextResponse.json({
      message: "Cập nhật thông tin cá nhân thành công!",
      user: toClientUserPublic(updated),
    });
  } catch (error) {
    console.error("PUT /api/client/account/profile error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật thông tin cá nhân" },
      { status: 500 }
    );
  }
}
