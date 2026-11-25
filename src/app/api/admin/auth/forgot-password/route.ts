import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

function hashOtp(email: string, otp: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email}:${otp}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `admin-forgot:${ip}:${email || "unknown"}`,
      3,
      5 * 60 * 1000
    );
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn đã yêu cầu OTP quá nhiều lần, vui lòng thử lại sau."
      );
    }

    if (!email) {
      return NextResponse.json(
        { message: "Vui lòng nhập email" },
        { status: 400 }
      );
    }

    const account = await prisma.adminAccount.findFirst({
      where: { email, deleted: false },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json({
        message: "Nếu email tồn tại trong hệ thống, mã OTP khôi phục đã được gửi.",
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const storedOtp = `0:${hashOtp(email, otp)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.forgotPassword.deleteMany({ where: { email } });
    await prisma.forgotPassword.create({
      data: { email, otp: storedOtp, expiresAt },
    });

    if (process.env.NODE_ENV !== "production") {
      console.info(`[TravelVN Auth][DEV] OTP for ${email}: ${otp}`);
    }

    return NextResponse.json({
      message: "Nếu email tồn tại trong hệ thống, mã OTP khôi phục đã được gửi.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { message: "Không thể gửi mã OTP lúc này" },
      { status: 500 }
    );
  }
}
