import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { CLIENT_USER_SELECT } from "@/lib/client-auth";
import { attachClientSessionCookie } from "@/lib/oauth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `client-login:${ip}:${email || "unknown"}`,
      10,
      5 * 60 * 1000
    );
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút."
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { message: "Vui lòng nhập đầy đủ email và mật khẩu" },
        { status: 400 }
      );
    }

    const account = await prisma.user.findFirst({
      where: { email, deleted: false },
      select: {
        ...CLIENT_USER_SELECT,
        password: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { message: "Email hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    if (!account.password) {
      return NextResponse.json(
        {
          message:
            account.provider !== "CREDENTIALS"
              ? `Tài khoản này đang đăng nhập qua ${account.provider}. Vui lòng chọn nút đăng nhập ${account.provider} hoặc đặt mật khẩu sau khi đăng nhập.`
              : "Tài khoản chưa được thiết lập mật khẩu",
        },
        { status: 400 }
      );
    }

    const isMatch = await verifyPassword(password, account.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Email hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    if (account.status !== RecordStatus.ACTIVE) {
      return NextResponse.json(
        { message: "Tài khoản của bạn đang bị tạm khóa" },
        { status: 403 }
      );
    }

    const { password: passwordHash, ...publicFields } = account;
    const user = { ...publicFields, hasPassword: true };
    const response = NextResponse.json({
      message: "Đăng nhập thành công!",
      user,
    });
    return await attachClientSessionCookie(response, user, req, passwordHash);
  } catch (error) {
    console.error("POST /api/client/auth/login error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng nhập" },
      { status: 500 }
    );
  }
}
