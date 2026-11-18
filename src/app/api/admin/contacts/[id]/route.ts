import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

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
