import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { validateCategoriesDeletable } from "@/lib/admin-api";
import { revalidateAllClientCatalogCache } from "@/lib/cache-tags";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    const auth = await requireAdmin(
      action === "DELETE" ? "category_delete" : "category_edit"
    );
    if (auth.error) return auth.error;
    const { admin } = auth;

    if (ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn ít nhất một danh mục" },
        { status: 400 }
      );
    }

    if (action === "ACTIVE" || action === "INACTIVE") {
      await prisma.category.updateMany({
        where: { id: { in: ids }, deleted: false },
        data: { status: action, updatedById: admin.id },
      });
      revalidateAllClientCatalogCache();
      return NextResponse.json({ message: "Cập nhật trạng thái thành công!" });
    }

    if (action === "DELETE") {
      const blockedMessage = await validateCategoriesDeletable(ids);
      if (blockedMessage) {
        return NextResponse.json({ message: blockedMessage }, { status: 400 });
      }

      await prisma.category.updateMany({
        where: { id: { in: ids } },
        data: {
          deleted: true,
          deletedById: admin.id,
          deletedAt: new Date(),
        },
      });
      revalidateAllClientCatalogCache();
      return NextResponse.json({ message: "Xóa các danh mục đã chọn!" });
    }

    return NextResponse.json(
      { message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/categories/bulk error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
