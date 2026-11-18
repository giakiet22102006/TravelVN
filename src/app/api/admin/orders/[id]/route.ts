import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";

class OrderUpdateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const item = await prisma.order.findFirst({
      where: { id, deleted: false },
      include: {
        items: true,
        updatedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy đơn hàng" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/orders/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin đơn hàng" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const note = body.note ? String(body.note).trim() : null;

    if (!fullName) {
      return NextResponse.json(
        { message: "Tên khách hàng không được để trống" },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { message: "Số điện thoại không được để trống" },
        { status: 400 }
      );
    }

    const paymentMethod = Object.values(PaymentMethod).includes(
      body.paymentMethod
    )
      ? (body.paymentMethod as PaymentMethod)
      : PaymentMethod.CASH;
    const paymentStatus = Object.values(PaymentStatus).includes(
      body.paymentStatus
    )
      ? (body.paymentStatus as PaymentStatus)
      : PaymentStatus.UNPAID;
    const nextStatus = Object.values(OrderStatus).includes(body.status)
      ? (body.status as OrderStatus)
      : OrderStatus.INITIAL;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id, deleted: false },
        include: { items: true },
      });

      if (!existing) {
        throw new OrderUpdateError("Không tìm thấy đơn hàng", 404);
      }

      // Restore tour inventory atomically when cancelling a non-cancelled order
      if (existing.status !== "CANCELLED" && nextStatus === "CANCELLED") {
        for (const item of existing.items) {
          if (!item.tourId) continue;
          await tx.tour.update({
            where: { id: item.tourId },
            data: {
              stockAdult: { increment: item.quantityAdult },
              stockChild: { increment: item.quantityChild },
              stockBaby: { increment: item.quantityBaby },
            },
          });
        }
      }

      // Re-reserve inventory if restoring a cancelled order back to active processing
      if (existing.status === "CANCELLED" && nextStatus !== "CANCELLED") {
        for (const item of existing.items) {
          if (!item.tourId) continue;
          const res = await tx.tour.updateMany({
            where: {
              id: item.tourId,
              deleted: false,
              stockAdult: { gte: item.quantityAdult },
              stockChild: { gte: item.quantityChild },
              stockBaby: { gte: item.quantityBaby },
            },
            data: {
              stockAdult: { decrement: item.quantityAdult },
              stockChild: { decrement: item.quantityChild },
              stockBaby: { decrement: item.quantityBaby },
            },
          });
          if (res.count === 0) {
            throw new OrderUpdateError(
              `Tour "${item.name}" không còn đủ chỗ trống để kích hoạt lại đơn hàng`,
              409
            );
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          fullName,
          phone,
          note,
          paymentMethod,
          paymentStatus,
          status: nextStatus,
          updatedById: admin.id,
        },
        include: { items: true },
      });
    });

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Cập nhật đơn hàng thành công!",
      item: updated,
    });
  } catch (error) {
    if (error instanceof OrderUpdateError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    console.error("PUT /api/admin/orders/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật đơn hàng" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.order.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy đơn hàng" },
        { status: 404 }
      );
    }

    await prisma.order.update({
      where: { id },
      data: {
        deleted: true,
        updatedById: admin.id,
      },
    });

    return NextResponse.json({ message: "Xóa đơn hàng thành công!" });
  } catch (error) {
    console.error("DELETE /api/admin/orders/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa đơn hàng" },
      { status: 500 }
    );
  }
}
