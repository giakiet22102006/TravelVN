import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const acceptTerms = Boolean(body.acceptTerms);

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { message: "Vui lòng điền đầy đủ họ tên, email và mật khẩu" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { message: "Vui lòng chấp nhận các điều khoản và điều kiện" },
        { status: 400 }
      );
    }

    const existing = await prisma.adminAccount.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Email này đã được đăng ký trong hệ thống" },
        { status: 409 }
      );
    }

    const defaultRole = await prisma.role.findFirst({
      where: { deleted: false },
      orderBy: { createdAt: "asc" },
    });

    const hashedPassword = await hashPassword(password);

    await prisma.adminAccount.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        password: hashedPassword,
        roleId: defaultRole?.id || null,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(
      { message: "Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng ký tài khoản" },
      { status: 500 }
    );
  }
}
