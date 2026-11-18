import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { generateUniqueNewsSlug } from "@/lib/admin-api";
import { revalidateClientNewsCache } from "@/lib/cache-tags";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const category = searchParams.get("category")?.trim();
    const featured = searchParams.get("featured");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 10)));

    const where: Prisma.NewsArticleWhereInput = { deleted: false };

    if (status === "ACTIVE" || status === "INACTIVE") {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }
    if (featured === "true") {
      where.featured = true;
    } else if (featured === "false") {
      where.featured = false;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { relatedDestination: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        orderBy: [
          { featured: "desc" },
          { position: "asc" },
          { publishedAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: { select: { id: true, fullName: true } },
          updatedBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.newsArticle.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/news error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách tin tức" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const category = String(body.category || "Cẩm nang du lịch").trim() || "Cẩm nang du lịch";
    const excerpt = String(body.excerpt || "").trim();
    const content = String(body.content || "").trim();
    const avatar = body.avatar ? String(body.avatar).trim() : null;
    const featured = Boolean(body.featured);
    const relatedDestination = body.relatedDestination
      ? String(body.relatedDestination).trim()
      : null;
    const position = Math.max(1, Math.floor(Number(body.position || 1) || 1));
    const status =
      body.status === "INACTIVE" ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
    const publishedAt = body.publishedAt
      ? new Date(String(body.publishedAt))
      : new Date();

    if (!title) {
      return NextResponse.json(
        { message: "Vui lòng nhập tiêu đề bài viết" },
        { status: 400 }
      );
    }
    if (!excerpt) {
      return NextResponse.json(
        { message: "Vui lòng nhập mô tả ngắn cho bài viết" },
        { status: 400 }
      );
    }
    if (!content) {
      return NextResponse.json(
        { message: "Vui lòng nhập nội dung bài viết" },
        { status: 400 }
      );
    }

    const slug = await generateUniqueNewsSlug(title);

    const created = await prisma.newsArticle.create({
      data: {
        title,
        slug,
        category,
        excerpt,
        content,
        avatar,
        featured,
        relatedDestination,
        position,
        status,
        publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    revalidateClientNewsCache();
    revalidatePath("/");
    revalidatePath("/news");

    return NextResponse.json(
      { message: "Tạo bài viết thành công!", item: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/news error:", error);
    return NextResponse.json(
      { message: "Lỗi tạo bài viết mới" },
      { status: 500 }
    );
  }
}
