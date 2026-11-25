import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { CLIENT_USER_SELECT } from "@/lib/client-auth";
import { attachClientSessionCookie } from "@/lib/oauth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`client-register:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn đăng ký quá nhiều lần, vui lòng thử lại sau."
      );
    }

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
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          message:
            "Email này đã được sử dụng. Nếu bạn từng đăng nhập bằng Google, vui lòng chọn Tiếp tục với Google.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const record = await prisma.user.create({
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
    return await attachClientSessionCookie(response, user, req, passwordHash);
  } catch (error) {
    console.error("POST /api/client/auth/register error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng ký tài khoản" },
      { status: 500 }
    );
  }
}
