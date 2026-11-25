import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { CLIENT_USER_SELECT, toClientUserPublic } from "@/lib/client-auth";
import { attachClientSessionCookie } from "@/lib/oauth";
import { grantWelcomeBonusTx } from "@/lib/loyalty";
import {
  claimSingleGuestOrderTx,
  OrderClaimError,
  verifyOrderClaimToken,
} from "@/lib/order-claim";
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

    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu đăng ký không hợp lệ" },
          { status: 400 }
        );
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { message: "Payload JSON không hợp lệ" },
        { status: 400 }
      );
    }
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const claimToken =
      typeof body.claimToken === "string" ? body.claimToken.trim() : "";

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

    const parsedClaim = claimToken ? verifyOrderClaimToken(claimToken) : null;
    if (claimToken && !parsedClaim) {
      return NextResponse.json(
        {
          message: "Liên kết lưu đơn hàng không hợp lệ hoặc đã hết hạn.",
          code: "INVALID_TOKEN",
        },
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

    const { user, claimResult } = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          email,
          phone: phone || parsedClaim?.phone || null,
          password: passwordHash,
          provider: "CREDENTIALS",
          status: RecordStatus.ACTIVE,
        },
        select: { id: true },
      });

      await grantWelcomeBonusTx(tx, created.id);

      let claimed: Awaited<ReturnType<typeof claimSingleGuestOrderTx>> | null =
        null;
      if (claimToken) {
        claimed = await claimSingleGuestOrderTx(tx, {
          userId: created.id,
          claimToken,
        });
      }

      const freshUser = await tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          ...CLIENT_USER_SELECT,
          password: true,
        },
      });

      return {
        user: toClientUserPublic(freshUser, { hasPassword: true }),
        claimResult: claimed,
      };
    });

    const response = NextResponse.json(
      {
        message: "Đăng ký tài khoản thành công!",
        user,
        ...(claimResult
          ? {
              claimedOrder: {
                ...claimResult.order,
                orderCode: claimResult.order.code,
              },
              pointsAwarded: claimResult.pointsAwarded,
            }
          : {}),
      },
      { status: 201 }
    );
    return await attachClientSessionCookie(response, user, req, passwordHash);
  } catch (error) {
    if (error instanceof OrderClaimError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "Email này đã được sử dụng. Nếu bạn từng đăng nhập bằng Google, vui lòng chọn Tiếp tục với Google.",
        },
        { status: 409 }
      );
    }
    console.error("POST /api/client/auth/register error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi đăng ký tài khoản" },
      { status: 500 }
    );
  }
}
