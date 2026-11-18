import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { CLIENT_USER_SELECT } from "@/lib/client-auth";
import { attachClientSessionCookie } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (!fullName) {
      return NextResponse.json(
        { message: "Vui lòng nhập họ và tên" },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "Email không hợp lệ" },
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

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        deleted: true,
        status: true,
      },
    });

    if (existing && !existing.deleted && existing.password) {
      return NextResponse.json(
        { message: "Email này đã được đăng ký tài khoản" },
        { status: 409 }
      );
    }

    if (existing && !existing.deleted && existing.status === RecordStatus.INACTIVE) {
      return NextResponse.json(
        { message: "Tài khoản này đang bị tạm khóa" },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);

    const record = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName,
            phone: phone || null,
            password: passwordHash,
            provider: "CREDENTIALS",
            deleted: false,
            status: RecordStatus.ACTIVE,
          },
          select: CLIENT_USER_SELECT,
        })
      : await prisma.user.create({
          data: {
            fullName,
            email,
            phone: phone || null,
            password: passwordHash,
            provider: "CREDENTIALS",
            status: RecordStatus.ACTIVE,
          },
          select: CLIENT_USER_SELECT,
        });

    const user = { ...record, hasPassword: true };
    const response = NextResponse.json(
      { message: "Đăng ký tài khoản thành công!", user },
      { status: 201 }
    );
    return await attachClientSessionCookie(response, user, req);
  } catch (error) {
    console.error("POST /api/client/auth/register error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng ký tài khoản" },
      { status: 500 }
    );
  }
}
