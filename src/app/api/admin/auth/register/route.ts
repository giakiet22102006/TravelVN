import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`admin-register:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn đăng ký quá nhiều lần, vui lòng thử lại sau."
      );
    }

    const adminCount = await prisma.adminAccount.count({
      where: { deleted: false },
    });
    const allowPublicRegister =
      process.env.ALLOW_ADMIN_REGISTER === "true" || adminCount === 0;

    if (!allowPublicRegister) {
      return NextResponse.json(
        {
          message:
            "Chức năng đăng ký quản trị viên công khai đã bị tắt. Vui lòng liên hệ Quản trị viên để được cấp tài khoản.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const acceptTerms = Boolean(body.acceptTerms);

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { message: "Vui lòng điền đầy đủ họ tên, email và mật khẩu" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { message: "Vui lòng chấp nhận các điều khoản và điều kiện" },
        { status: 400 }
      );
    }

    const existing = await prisma.adminAccount.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Email này đã được đăng ký trong hệ thống" },
        { status: 409 }
      );
    }

    const isBootstrap = adminCount === 0;
    const defaultRole = isBootstrap
      ? await prisma.role.findFirst({
          where: { deleted: false },
          orderBy: { createdAt: "asc" },
        })
      : null;

    const hashedPassword = await hashPassword(password);

    await prisma.adminAccount.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        password: hashedPassword,
        roleId: isBootstrap ? defaultRole?.id || null : null,
        status: isBootstrap ? RecordStatus.ACTIVE : RecordStatus.INITIAL,
      },
    });

    return NextResponse.json(
      {
        message: isBootstrap
          ? "Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay."
          : "Đăng ký tài khoản thành công! Vui lòng chờ Quản trị viên kích hoạt tài khoản.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng ký tài khoản" },
      { status: 500 }
    );
  }
}
