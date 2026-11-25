import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";
import { restoreOrderInventoryShared } from "@/lib/order-holds";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, deleted: false },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json(
        { message: "Không tìm thấy đơn hàng" },
        { status: 404 }
      );
    }

    const isOwner = order.userId === currentUser.id;

    if (!isOwner) {
      return NextResponse.json(
        { message: "Bạn không có quyền thao tác đơn hàng này" },
        { status: 403 }
      );
    }

    if (order.status !== OrderStatus.INITIAL) {
      return NextResponse.json(
        {
          message:
            "Chỉ có thể hủy đơn hàng đang ở trạng thái chờ duyệt (Khởi tạo)",
        },
        { status: 400 }
      );
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.order.updateMany({
        where: {
          id: order.id,
          deleted: false,
          status: OrderStatus.INITIAL,
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: "CUSTOMER_CANCELLED",
        },
      });

      if (updatedCount.count === 0) {
        return false;
      }

      await restoreOrderInventoryShared(tx, order.items);

      return true;
    });

    if (!cancelled) {
      return NextResponse.json(
        { message: "Đơn hàng đã thay đổi trạng thái trước đó" },
        { status: 409 }
      );
    }

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Đã hủy đơn hàng và hoàn trả số chỗ thành công!",
    });
  } catch (error) {
    console.error("PATCH /api/client/account/orders/[id]/cancel error:", error);
    return NextResponse.json(
      { message: "Lỗi hủy đơn hàng" },
      { status: 500 }
    );
  }
}
