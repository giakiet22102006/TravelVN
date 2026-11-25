import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  RESET_TOKEN_COOKIE,
  buildCookieOptions,
  computePasswordSig,
  isHttpsRequest,
  signResetToken,
} from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

const MAX_OTP_ATTEMPTS = 5;

function hashOtp(email: string, otp: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email}:${otp}`)
    .digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `admin-otp:${ip}:${email || "unknown"}`,
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

    const record = await prisma.forgotPassword.findFirst({
      where: {
        email,
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

    const colonIdx = record.otp.indexOf(":");
    const attempts =
      colonIdx > 0 ? Number.parseInt(record.otp.slice(0, colonIdx), 10) || 0 : 0;
    const storedHash = colonIdx > 0 ? record.otp.slice(colonIdx + 1) : "";
    const expectedHash = hashOtp(email, otp);

    if (!storedHash || !constantTimeEquals(storedHash, expectedHash)) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        await prisma.forgotPassword.deleteMany({ where: { email } });
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
        data: { otp: `${nextAttempts}:${storedHash}` },
      });
      return NextResponse.json(
        { message: "Mã OTP không đúng hoặc đã hết hạn" },
        { status: 400 }
      );
    }

    const adminAccount = await prisma.adminAccount.findFirst({
      where: { email, deleted: false },
      select: { id: true, password: true },
    });

    if (!adminAccount) {
      return NextResponse.json(
        { message: "Mã OTP không đúng hoặc đã hết hạn" },
        { status: 400 }
      );
    }

    await prisma.forgotPassword.deleteMany({ where: { email } });

    const pwdSig = await computePasswordSig(adminAccount.password);
    const resetToken = await signResetToken(email, pwdSig);
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
