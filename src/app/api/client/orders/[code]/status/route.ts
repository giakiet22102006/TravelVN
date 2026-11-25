import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { releaseExpiredOrderHolds } from "@/lib/order-holds";
import {
  isPaymentSandboxEnabled,
  processSignedPaymentWebhook,
  signWebhookPayload,
} from "@/lib/payment-webhook";

export const dynamic = "force-dynamic";

function normalizePhone(input: string): string {
  return input.trim().replace(/[\s.-]/g, "");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const orderCode = decodeURIComponent(code || "").trim();
    if (!orderCode) {
      return NextResponse.json(
        { message: "Thiếu mã đơn hàng" },
        { status: 400 }
      );
    }

    await releaseExpiredOrderHolds({ orderCode });

    const [currentUser, order] = await Promise.all([
      getCurrentUser(),
      prisma.order.findFirst({
        where: { code: orderCode, deleted: false },
        select: {
          code: true,
          userId: true,
          phone: true,
          status: true,
          paymentStatus: true,
          refundStatus: true,
          paymentMethod: true,
          total: true,
          pointsEarned: true,
          expiresAt: true,
          paidAt: true,
        },
      }),
    ]);

    if (!order) {
      return NextResponse.json(
        { message: "Không tìm thấy đơn hàng" },
        { status: 404 }
      );
    }

    const phoneQuery = req.nextUrl.searchParams.get("phone") || "";
    const isUserOwner = Boolean(currentUser && order.userId === currentUser.id);
    const isPhoneOwner = Boolean(
      phoneQuery.trim() &&
        normalizePhone(phoneQuery) === normalizePhone(order.phone)
    );

    if (!isUserOwner && !isPhoneOwner) {
      return NextResponse.json(
        { message: "Không có quyền xem trạng thái đơn hàng này" },
        { status: currentUser || phoneQuery.trim() ? 403 : 401 }
      );
    }

    return NextResponse.json({
      order: {
        code: order.code,
        status: order.status,
        paymentStatus: order.paymentStatus,
        refundStatus: order.refundStatus,
        paymentMethod: order.paymentMethod,
        total: order.total,
        pointsEarned: order.pointsEarned,
        expiresAt: order.expiresAt,
        paidAt: order.paidAt,
      },
      sandboxEnabled: isPaymentSandboxEnabled(),
    });
  } catch (error) {
    console.error("GET /api/client/orders/[code]/status error:", error);
    return NextResponse.json(
      { message: "Lỗi kiểm tra trạng thái thanh toán" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    if (!isPaymentSandboxEnabled()) {
      return NextResponse.json(
        { message: "Chế độ mô phỏng thanh toán Sandbox đã tắt trên môi trường này" },
        { status: 403 }
      );
    }

    const { code } = await params;
    const orderCode = decodeURIComponent(code || "").trim();
    if (!orderCode) {
      return NextResponse.json(
        { message: "Thiếu mã đơn hàng" },
        { status: 400 }
      );
    }

    let bodyPhone = "";
    try {
      const body = await req.json();
      if (body && typeof body.phone === "string") {
        bodyPhone = body.phone;
      }
    } catch {
      bodyPhone = "";
    }

    const phoneQuery = bodyPhone || req.nextUrl.searchParams.get("phone") || "";

    const [currentUser, order] = await Promise.all([
      getCurrentUser(),
      prisma.order.findFirst({
        where: { code: orderCode, deleted: false },
        select: {
          code: true,
          userId: true,
          phone: true,
          total: true,
        },
      }),
    ]);

    if (!order) {
      return NextResponse.json(
        { message: "Không tìm thấy đơn hàng" },
        { status: 404 }
      );
    }

    const isUserOwner = Boolean(currentUser && order.userId === currentUser.id);
    const isPhoneOwner = Boolean(
      phoneQuery.trim() &&
        normalizePhone(phoneQuery) === normalizePhone(order.phone)
    );

    if (!isUserOwner && !isPhoneOwner) {
      return NextResponse.json(
        { message: "Không có quyền thao tác đơn hàng này" },
        { status: currentUser || phoneQuery.trim() ? 403 : 401 }
      );
    }

    const rawBody = JSON.stringify({
      eventId: `SANDBOX_${order.code}_${Date.now()}`,
      orderCode: order.code,
      amount: order.total,
      provider: "SANDBOX_VIETQR",
    });

    const signature = signWebhookPayload(rawBody);
    const result = await processSignedPaymentWebhook(rawBody, signature);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/client/orders/[code]/status error:", error);
    return NextResponse.json(
      { message: "Lỗi mô phỏng thanh toán sandbox" },
      { status: 500 }
    );
  }
}
