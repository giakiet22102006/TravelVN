import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const statusParam = req.nextUrl.searchParams.get("status")?.trim() || "";
    const where: Prisma.OrderWhereInput = {
      deleted: false,
      userId: currentUser.id,
    };

    if (
      statusParam === OrderStatus.INITIAL ||
      statusParam === OrderStatus.APPROVED ||
      statusParam === OrderStatus.CANCELLED
    ) {
      where.status = statusParam;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            tour: {
              select: { slug: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/client/account/orders error:", error);
    return NextResponse.json(
      { message: "Lỗi tải lịch sử đơn hàng" },
      { status: 500 }
    );
  }
}
