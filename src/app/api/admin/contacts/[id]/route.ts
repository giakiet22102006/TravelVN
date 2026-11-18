import { NextRequest, NextResponse } from "next/server";
import { ContactStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("contact_edit");
    if (auth.error) return auth.error;

    const { id } = await params;
    const existing = await prisma.contact.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy thông tin liên hệ" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const status =
      body.status === ContactStatus.PROCESSED
        ? ContactStatus.PROCESSED
        : ContactStatus.NEW;

    const item = await prisma.contact.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      message:
        status === ContactStatus.PROCESSED
          ? "Đã đánh dấu đã liên hệ khách!"
          : "Đã chuyển lại trạng thái chưa xử lý!",
      item,
    });
  } catch (error) {
    console.error("PATCH /api/admin/contacts/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật trạng thái liên hệ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("contact_delete");
    if (auth.error) return auth.error;

    const { id } = await params;
    const existing = await prisma.contact.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy thông tin liên hệ" },
        { status: 404 }
      );
    }

    await prisma.contact.update({
      where: { id },
      data: { deleted: true },
    });

    return NextResponse.json({ message: "Xóa thông tin liên hệ thành công!" });
  } catch (error) {
    console.error("DELETE /api/admin/contacts/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa thông tin liên hệ" },
      { status: 500 }
    );
  }
}
