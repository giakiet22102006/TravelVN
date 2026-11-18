import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";

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
    await prisma.tour.delete({
      where: { id },
    });

    revalidateClientToursCache();

    return NextResponse.json({ message: "Đã xóa vĩnh viễn tour!" });
  } catch (error) {
    console.error("DELETE /api/admin/tours/[id]/permanent error:", error);
    return NextResponse.json(
      { message: "Lỗi khi xóa vĩnh viễn tour" },
      { status: 500 }
    );
  }
}
