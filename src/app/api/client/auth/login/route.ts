import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { CLIENT_USER_SELECT, toClientUserPublic } from "@/lib/client-auth";
import { attachClientSessionCookie } from "@/lib/oauth";
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
    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu đăng nhập không hợp lệ" },
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
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const claimToken =
      typeof body.claimToken === "string" ? body.claimToken.trim() : "";

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

    const passwordHash = account.password;
    let user = toClientUserPublic(account, { hasPassword: true });
    let claimResult: Awaited<ReturnType<typeof claimSingleGuestOrderTx>> | null =
      null;

    if (claimToken) {
      if (!verifyOrderClaimToken(claimToken)) {
        return NextResponse.json(
          {
            message: "Liên kết lưu đơn hàng không hợp lệ hoặc đã hết hạn.",
            code: "INVALID_TOKEN",
          },
          { status: 400 }
        );
      }

      try {
        const claimed = await prisma.$transaction(async (tx) => {
          const result = await claimSingleGuestOrderTx(tx, {
            userId: account.id,
            claimToken,
          });
          const freshUser = await tx.user.findUniqueOrThrow({
            where: { id: account.id },
            select: {
              ...CLIENT_USER_SELECT,
              password: true,
            },
          });
          return {
            user: toClientUserPublic(freshUser, { hasPassword: true }),
            claimResult: result,
          };
        });
        user = claimed.user;
        claimResult = claimed.claimResult;
      } catch (err) {
        if (err instanceof OrderClaimError) {
          return NextResponse.json(
            { message: err.message, code: err.code },
            { status: err.status }
          );
        }
        throw err;
      }
    }

    const response = NextResponse.json({
      message: "Đăng nhập thành công!",
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
