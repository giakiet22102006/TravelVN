import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { message: "Vui lòng nhập email" },
        { status: 400 }
      );
    }

    const account = await prisma.adminAccount.findFirst({
      where: { email, deleted: false },
    });

    if (!account) {
      return NextResponse.json({
        message: "Nếu email tồn tại trong hệ thống, mã OTP khôi phục đã được gửi.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.forgotPassword.deleteMany({ where: { email } });
    await prisma.forgotPassword.create({
      data: { email, otp, expiresAt },
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
