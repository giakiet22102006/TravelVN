import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  RESET_TOKEN_COOKIE,
  buildCookieOptions,
  computePasswordSig,
  hashPassword,
  isHttpsRequest,
  verifyResetToken,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const resetToken = cookieStore.get(RESET_TOKEN_COOKIE)?.value;

    if (!resetToken) {
      return NextResponse.json(
        { message: "Phiên đặt lại mật khẩu đã hết hạn, vui lòng thử lại" },
        { status: 401 }
      );
    }

    const resetPayload = await verifyResetToken(resetToken);
    if (!resetPayload) {
      return NextResponse.json(
        { message: "Token đặt lại mật khẩu không hợp lệ" },
        { status: 401 }
      );
    }

    const account = await prisma.adminAccount.findFirst({
      where: { email: resetPayload.email, deleted: false },
      select: { id: true, email: true, password: true },
    });

    if (!account) {
      return NextResponse.json(
        { message: "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa" },
        { status: 401 }
      );
    }

    if (
      resetPayload.pwdSig &&
      resetPayload.pwdSig !== (await computePasswordSig(account.password))
    ) {
      return NextResponse.json(
        { message: "Token đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: "Mật khẩu xác nhận không khớp" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    await prisma.adminAccount.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });

    const response = NextResponse.json({
      message: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
    });

    response.cookies.set(
      RESET_TOKEN_COOKIE,
      "",
      buildCookieOptions(0, isHttpsRequest(req))
    );

    return response;
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { message: "Không thể đổi mật khẩu" },
      { status: 500 }
    );
  }
}
