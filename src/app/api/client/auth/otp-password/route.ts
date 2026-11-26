import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLIENT_RESET_TOKEN_COOKIE,
  buildCookieOptions,
  computePasswordSig,
  isHttpsRequest,
  signClientResetToken,
} from "@/lib/auth";
import {
  MAX_OTP_ATTEMPTS,
  buildOtpStorageKey,
  hashOtp,
  packOtpRecord,
  parseOtpRecord,
  verifyOtpConstantTime,
} from "@/lib/otp";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `client-otp:${ip}:${email || "unknown"}`,
      5,
      5 * 60 * 1000
    );
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn đã thử xác thực OTP quá nhiều lần, vui lòng thử lại sau."
      );
    }

    if (!email || !otp) {
      return NextResponse.json(
        { message: "Vui lòng nhập email và mã OTP" },
        { status: 400 }
      );
    }

    const storageKey = buildOtpStorageKey("client", email);
    const record = await prisma.forgotPassword.findFirst({
      where: {
        email: storageKey,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { message: "Mã OTP không đúng hoặc đã hết hạn" },
        { status: 400 }
      );
    }

    const { attempts, hash: storedHash } = parseOtpRecord(record.otp);
    const expectedHash = hashOtp(storageKey, otp);

    if (!verifyOtpConstantTime(storedHash, expectedHash)) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        await prisma.forgotPassword.deleteMany({ where: { email: storageKey } });
        return NextResponse.json(
          {
            message:
              "Mã OTP đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.",
          },
          { status: 400 }
        );
      }
      await prisma.forgotPassword.update({
        where: { id: record.id },
        data: { otp: packOtpRecord(nextAttempts, storedHash) },
      });
      return NextResponse.json(
        { message: "Mã OTP không đúng hoặc đã hết hạn" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email, deleted: false, status: "ACTIVE" },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Mã OTP không đúng hoặc đã hết hạn" },
        { status: 400 }
      );
    }

    await prisma.forgotPassword.deleteMany({ where: { email: storageKey } });

    const pwdSig = await computePasswordSig(user.password);
    const resetToken = await signClientResetToken(email, pwdSig);
    const response = NextResponse.json({
      message: "Xác thực OTP thành công!",
    });

    response.cookies.set(
      CLIENT_RESET_TOKEN_COOKIE,
      resetToken,
      buildCookieOptions(10 * 60, isHttpsRequest(req))
    );

    return response;
  } catch (error) {
    console.error("Client verify OTP error:", error);
    return NextResponse.json(
      { message: "Lỗi xác thực OTP" },
      { status: 500 }
    );
  }
}
