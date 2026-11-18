import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateUniqueNewsSlug } from "@/lib/admin-api";
import { revalidateClientNewsCache } from "@/lib/cache-tags";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(["news_view", "news_edit"]);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const item = await prisma.newsArticle.findFirst({
      where: { id, deleted: false },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy bài viết" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/news/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải chi tiết bài viết" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("news_edit");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await context.params;
    const existing = await prisma.newsArticle.findFirst({
      where: { id, deleted: false },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Bài viết không tồn tại" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data: Record<string, unknown> = {
      updatedById: admin.id,
    };

    if (typeof body.title === "string") {
      const nextTitle = body.title.trim();
      if (!nextTitle) {
        return NextResponse.json(
          { message: "Tiêu đề không được để trống" },
          { status: 400 }
        );
      }
      data.title = nextTitle;
      if (nextTitle !== existing.title) {
        data.slug = await generateUniqueNewsSlug(nextTitle, id);
      }
    }

    if (typeof body.category === "string") {
      data.category = body.category.trim() || "Cẩm nang du lịch";
    }
    if (typeof body.excerpt === "string") {
      const nextExcerpt = body.excerpt.trim();
      if (!nextExcerpt) {
        return NextResponse.json(
          { message: "Mô tả ngắn không được để trống" },
          { status: 400 }
        );
      }
      data.excerpt = nextExcerpt;
    }
    if (typeof body.content === "string") {
      const nextContent = body.content.trim();
      if (!nextContent) {
        return NextResponse.json(
          { message: "Nội dung không được để trống" },
          { status: 400 }
        );
      }
      data.content = nextContent;
    }
    if ("avatar" in body) {
      data.avatar = body.avatar ? String(body.avatar).trim() : null;
    }
    if ("featured" in body) {
      data.featured = Boolean(body.featured);
    }
    if ("relatedDestination" in body) {
      data.relatedDestination = body.relatedDestination
        ? String(body.relatedDestination).trim()
        : null;
    }
    if ("position" in body) {
      data.position = Math.max(1, Math.floor(Number(body.position || 1) || 1));
    }
    if (body.status === "ACTIVE" || body.status === "INACTIVE") {
      data.status = body.status as RecordStatus;
    }
    if (body.publishedAt) {
      const dt = new Date(String(body.publishedAt));
      if (!Number.isNaN(dt.getTime())) {
        data.publishedAt = dt;
      }
    }

    const updated = await prisma.newsArticle.update({
      where: { id },
      data,
    });

    revalidateClientNewsCache();
    revalidatePath("/");
    revalidatePath("/news");
    revalidatePath(`/news/${existing.slug}`);
    if (updated.slug !== existing.slug) {
      revalidatePath(`/news/${updated.slug}`);
    }

    return NextResponse.json({
      message: "Cập nhật bài viết thành công!",
      item: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/news/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật bài viết" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("news_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await context.params;
    const existing = await prisma.newsArticle.findFirst({
      where: { id, deleted: false },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Bài viết không tồn tại" },
        { status: 404 }
      );
    }

    await prisma.newsArticle.update({
      where: { id },
      data: {
        deleted: true,
        updatedById: admin.id,
      },
    });

    revalidateClientNewsCache();
    revalidatePath("/");
    revalidatePath("/news");
    revalidatePath(`/news/${existing.slug}`);

    return NextResponse.json({ message: "Đã xóa bài viết!" });
  } catch (error) {
    console.error("DELETE /api/admin/news/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa bài viết" },
      { status: 500 }
    );
  }
}
