import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetOtpEmail } from "@/lib/email";
import {
  OTP_TTL_MS,
  buildOtpStorageKey,
  generateNumericOtp,
  hashOtp,
  packOtpRecord,
} from "@/lib/otp";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

const GENERIC_RESPONSE = {
  message: "Nếu email tồn tại trong hệ thống, mã OTP khôi phục đã được gửi.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `client-forgot:${ip}:${email || "unknown"}`,
      3,
      5 * 60 * 1000
    );
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn đã yêu cầu OTP quá nhiều lần, vui lòng thử lại sau."
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "Vui lòng nhập địa chỉ email hợp lệ" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email, deleted: false, status: "ACTIVE" },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const storageKey = buildOtpStorageKey("client", email);
    const otp = generateNumericOtp();
    const storedOtp = packOtpRecord(0, hashOtp(storageKey, otp));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.forgotPassword.deleteMany({ where: { email: storageKey } });
    await prisma.forgotPassword.create({
      data: { email: storageKey, otp: storedOtp, expiresAt },
    });

    const emailResult = await sendPasswordResetOtpEmail({
      to: email,
      otp,
      scope: "client",
      expiresMinutes: 5,
    });

    if (!emailResult.sent && process.env.NODE_ENV !== "production") {
      console.info(`[TravelVN Auth][DEV] Client OTP for ${email}: ${otp}`);
    } else if (emailResult.error) {
      console.error(
        "[TravelVN Auth] Failed to send client OTP email:",
        emailResult.error
      );
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("Client forgot password error:", error);
    return NextResponse.json(
      { message: "Không thể gửi mã OTP lúc này" },
      { status: 500 }
    );
  }
}
