import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  generateUniqueCategorySlug,
  validateCategoriesDeletable,
} from "@/lib/admin-api";
import { revalidateAllClientCatalogCache } from "@/lib/cache-tags";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(["category_view", "category_edit"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const item = await prisma.category.findFirst({
      where: { id, deleted: false },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy danh mục" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/categories/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin danh mục" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("category_edit");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    const existing = await prisma.category.findFirst({
      where: { id, deleted: false },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy danh mục" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { message: "Tên danh mục không được để trống" },
        { status: 400 }
      );
    }

    const parentId = body.parentId || null;
    if (parentId === id) {
      return NextResponse.json(
        { message: "Danh mục không thể là danh mục cha của chính nó" },
        { status: 400 }
      );
    }

    const slug =
      name !== existing.name
        ? await generateUniqueCategorySlug(name, id)
        : existing.slug;

    const status: RecordStatus =
      body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const position = Math.max(1, Number(body.position || 1));

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        parentId,
        avatar: body.avatar || null,
        position,
        status,
        description: body.description || null,
        updatedById: admin.id,
      },
    });

    revalidateAllClientCatalogCache();

    return NextResponse.json({
      message: "Cập nhật danh mục thành công!",
      item: updated,
    });
  } catch (error) {
    console.error("PUT /api/admin/categories/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật danh mục" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("category_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    const existing = await prisma.category.findFirst({
      where: { id, deleted: false },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy danh mục" },
        { status: 404 }
      );
    }

    const blockedMessage = await validateCategoriesDeletable([id]);
    if (blockedMessage) {
      return NextResponse.json({ message: blockedMessage }, { status: 400 });
    }

    await prisma.category.update({
      where: { id },
      data: {
        deleted: true,
        deletedById: admin.id,
        deletedAt: new Date(),
      },
    });

    revalidateAllClientCatalogCache();

    return NextResponse.json({ message: "Xóa danh mục thành công!" });
  } catch (error) {
    console.error("DELETE /api/admin/categories/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa danh mục" },
      { status: 500 }
    );
  }
}
