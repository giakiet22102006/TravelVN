import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  RESET_TOKEN_COOKIE,
  buildCookieOptions,
  isHttpsRequest,
  signResetToken,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    if (!email || !otp) {
      return NextResponse.json(
        { message: "Vui lòng nhập email và mã OTP" },
        { status: 400 }
      );
    }

    const record = await prisma.forgotPassword.findFirst({
      where: {
        email,
        otp,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      return NextResponse.json(
        { message: "Mã OTP không đúng hoặc đã hết hạn" },
        { status: 400 }
      );
    }

    await prisma.forgotPassword.deleteMany({ where: { email } });

    const resetToken = await signResetToken(email);
    const response = NextResponse.json({
      message: "Xác thực OTP thành công!",
    });

    response.cookies.set(
      RESET_TOKEN_COOKIE,
      resetToken,
      buildCookieOptions(10 * 60, isHttpsRequest(req))
    );

    return response;
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { message: "Lỗi xác thực OTP" },
      { status: 500 }
    );
  }
}
