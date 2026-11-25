import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  CLIENT_USER_SELECT,
  getCurrentUser,
  toClientUserPublic,
} from "@/lib/client-auth";
import { attachClientSessionCookie } from "@/lib/oauth";
import { grantWelcomeBonusTx } from "@/lib/loyalty";
import {
  claimSingleGuestOrderTx,
  normalizePhone,
  OrderClaimError,
  verifyOrderClaimToken,
} from "@/lib/order-claim";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

class ClaimRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { message: "Dữ liệu yêu cầu không hợp lệ" },
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

    const mode = typeof body.mode === "string" ? body.mode.trim() : "";

    if (mode === "quick-register") {
      const ip = getClientIp(req);
      const rl = checkRateLimit(
        `order-claim-quick:${ip}`,
        10,
        10 * 60 * 1000
      );
      if (!rl.allowed) {
        return rateLimitExceededResponse(
          rl.retryAfterSec,
          "Bạn thao tác tạo tài khoản lưu đơn quá nhanh, vui lòng thử lại sau."
        );
      }

      const claimToken =
        typeof body.claimToken === "string" ? body.claimToken.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const fullName =
        typeof body.fullName === "string" ? body.fullName.trim() : "";

      const parsed = verifyOrderClaimToken(claimToken);
      if (!parsed) {
        return NextResponse.json(
          {
            message: "Liên kết lưu đơn hàng không hợp lệ hoặc đã hết hạn.",
            code: "INVALID_TOKEN",
          },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { message: "Mật khẩu phải có ít nhất 6 ký tự" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(password);

      const { user, claimResult, welcomeBonus } = await prisma.$transaction(
        async (tx) => {
          const targetOrder = await tx.order.findFirst({
            where: { id: parsed.orderId, deleted: false },
            select: {
              id: true,
              code: true,
              fullName: true,
              phone: true,
              email: true,
              userId: true,
            },
          });

          if (!targetOrder) {
            throw new OrderClaimError("NOT_FOUND");
          }

          if (
            targetOrder.code !== parsed.orderCode ||
            normalizePhone(targetOrder.phone) !== normalizePhone(parsed.phone) ||
            (targetOrder.email ?? "").trim().toLowerCase() !== parsed.email
          ) {
            throw new OrderClaimError("INVALID_TOKEN");
          }

          if (targetOrder.userId !== null) {
            throw new OrderClaimError("ALREADY_CLAIMED");
          }

          const existingUser = await tx.user.findUnique({
            where: { email: parsed.email },
            select: { id: true, deleted: true, status: true },
          });

          if (existingUser) {
            if (
              !existingUser.deleted &&
              existingUser.status === RecordStatus.ACTIVE
            ) {
              throw new ClaimRouteError(
                "EMAIL_EXISTS",
                "Email này đã có tài khoản. Vui lòng đăng nhập để lưu đơn hàng.",
                409
              );
            }
            throw new ClaimRouteError(
              "ACCOUNT_LOCKED",
              "Tài khoản với email này đang bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ CSKH.",
              403
            );
          }

          const resolvedFullName =
            fullName || targetOrder.fullName || parsed.email.split("@")[0];

          const created = await tx.user.create({
            data: {
              fullName: resolvedFullName,
              email: parsed.email,
              phone: targetOrder.phone,
              password: passwordHash,
              provider: "CREDENTIALS",
              status: RecordStatus.ACTIVE,
            },
            select: { id: true },
          });

          const welcome = await grantWelcomeBonusTx(tx, created.id);
          const claimed = await claimSingleGuestOrderTx(tx, {
            userId: created.id,
            claimToken,
          });

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
            welcomeBonus: welcome.points,
          };
        }
      );

      const response = NextResponse.json(
        {
          message: "Tạo tài khoản và lưu đơn hàng thành công!",
          user,
          claimedOrder: {
            ...claimResult.order,
            orderCode: claimResult.order.code,
          },
          pointsAwarded: claimResult.pointsAwarded,
          welcomeBonus,
        },
        { status: 201 }
      );
      return await attachClientSessionCookie(response, user, req, passwordHash);
    }

    if (mode === "link") {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return NextResponse.json(
          { message: "Chưa đăng nhập" },
          { status: 401 }
        );
      }

      const claimToken =
        typeof body.claimToken === "string" ? body.claimToken.trim() : "";
      const orderCode =
        typeof body.orderCode === "string" ? body.orderCode.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";

      if (!claimToken) {
        if (!orderCode || !phone) {
          return NextResponse.json(
            { message: "Vui lòng nhập đầy đủ mã đơn hàng và số điện thoại" },
            { status: 400 }
          );
        }

        const ip = getClientIp(req);
        const userRl = checkRateLimit(
          `claim-order-user:${currentUser.id}`,
          5,
          10 * 60 * 1000
        );
        if (!userRl.allowed) {
          return rateLimitExceededResponse(
            userRl.retryAfterSec,
            "Bạn nhập sai thông tin liên kết đơn quá nhiều lần, vui lòng thử lại sau 10 phút."
          );
        }

        const ipRl = checkRateLimit(
          `claim-order-ip:${ip}`,
          20,
          10 * 60 * 1000
        );
        if (!ipRl.allowed) {
          return rateLimitExceededResponse(
            ipRl.retryAfterSec,
            "Bạn nhập sai thông tin liên kết đơn quá nhiều lần, vui lòng thử lại sau 10 phút."
          );
        }
      }

      const { user, claimResult } = await prisma.$transaction(async (tx) => {
        const claimed = await claimSingleGuestOrderTx(tx, {
          userId: currentUser.id,
          claimToken: claimToken || undefined,
          orderCode: orderCode || undefined,
          phone: phone || undefined,
        });

        const freshUser = await tx.user.findUniqueOrThrow({
          where: { id: currentUser.id },
          select: {
            ...CLIENT_USER_SELECT,
            password: true,
          },
        });

        return {
          user: toClientUserPublic(freshUser),
          claimResult: claimed,
        };
      });

      return NextResponse.json(
        {
          message: "Liên kết đơn hàng thành công!",
          user,
          claimedOrder: {
            ...claimResult.order,
            orderCode: claimResult.order.code,
          },
          pointsAwarded: claimResult.pointsAwarded,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: "Chế độ liên kết đơn hàng không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof OrderClaimError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof ClaimRouteError) {
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
          message: "Thông tin tài khoản hoặc giao dịch điểm đã tồn tại.",
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }
    console.error("POST /api/client/orders/claim error:", error);
    return NextResponse.json(
      { message: "Có lỗi xảy ra khi liên kết đơn hàng" },
      { status: 500 }
    );
  }
}
