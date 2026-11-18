import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  buildDateRangeFilter,
  generateUniqueCategorySlug,
} from "@/lib/admin-api";
import { revalidateAllClientCatalogCache } from "@/lib/cache-tags";

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get("all") === "true";
    const auth = await requireAdmin(
      all ? ["category_view", "tour_create", "tour_edit"] : "category_view"
    );
    if (auth.error) return auth.error;

    const { searchParams } = req.nextUrl;

    if (all) {
      const items = await prisma.category.findMany({
        where: { deleted: false },
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          parentId: true,
          status: true,
        },
      });
      return NextResponse.json({ items });
    }

    const status = searchParams.get("status");
    const createdById = searchParams.get("createdById");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 10)));

    const where: Prisma.CategoryWhereInput = {
      deleted: false,
    };

    if (status === "ACTIVE" || status === "INACTIVE") {
      where.status = status;
    }
    if (createdById) {
      where.createdById = createdById;
    }
    const createdAtFilter = buildDateRangeFilter(startDate, endDate);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total, creators] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          parent: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          updatedBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.category.count({ where }),
      prisma.adminAccount.findMany({
        where: { deleted: false },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      creators,
    });
  } catch (error) {
    console.error("GET /api/admin/categories error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách danh mục" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin("category_create");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { message: "Tên danh mục không được để trống" },
        { status: 400 }
      );
    }

    const slug = await generateUniqueCategorySlug(name);
    const status: RecordStatus =
      body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const position = Math.max(1, Number(body.position || 1));

    const created = await prisma.category.create({
      data: {
        name,
        slug,
        parentId: body.parentId || null,
        avatar: body.avatar || null,
        position,
        status,
        description: body.description || null,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    revalidateAllClientCatalogCache();

    return NextResponse.json(
      { message: "Tạo danh mục thành công!", item: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/categories error:", error);
    return NextResponse.json(
      { message: "Lỗi khi tạo danh mục" },
      { status: 500 }
    );
  }
}
