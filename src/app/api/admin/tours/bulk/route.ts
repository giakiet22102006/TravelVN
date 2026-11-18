import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const action = String(body.action || "");
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn ít nhất một tour" },
        { status: 400 }
      );
    }

    if (action === "ACTIVE" || action === "INACTIVE") {
      await prisma.tour.updateMany({
        where: { id: { in: ids }, deleted: false },
        data: { status: action, updatedById: admin.id },
      });
      revalidateClientToursCache();
      return NextResponse.json({ message: "Cập nhật trạng thái thành công!" });
    }

    if (action === "DELETE") {
      await prisma.tour.updateMany({
        where: { id: { in: ids } },
        data: {
          deleted: true,
          deletedById: admin.id,
          deletedAt: new Date(),
        },
      });
      revalidateClientToursCache();
      return NextResponse.json({
        message: "Đã chuyển các tour đã chọn vào thùng rác!",
      });
    }

    if (action === "RESTORE") {
      await prisma.tour.updateMany({
        where: { id: { in: ids } },
        data: {
          deleted: false,
          deletedById: null,
          deletedAt: null,
          updatedById: admin.id,
        },
      });
      revalidateClientToursCache();
      return NextResponse.json({
        message: "Khôi phục các tour đã chọn thành công!",
      });
    }

    if (action === "PERMANENT_DELETE") {
      await prisma.tour.deleteMany({
        where: { id: { in: ids }, deleted: true },
      });
      revalidateClientToursCache();
      return NextResponse.json({
        message: "Đã xóa vĩnh viễn các tour đã chọn!",
      });
    }

    return NextResponse.json(
      { message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/tours/bulk error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
