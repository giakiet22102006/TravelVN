import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import {
  buildDateRangeFilter,
  generateUniqueTourCode,
  generateUniqueTourSlug,
} from "@/lib/admin-api";
import { revalidateClientToursCache } from "@/lib/cache-tags";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const isDeleted = searchParams.get("deleted") === "true";
    const status = searchParams.get("status");
    const createdById = searchParams.get("createdById");
    const categoryId = searchParams.get("categoryId");
    const priceRange = searchParams.get("priceRange");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 10)));

    const where: Prisma.TourWhereInput = {
      deleted: isDeleted,
    };

    if (!isDeleted && (status === "ACTIVE" || status === "INACTIVE")) {
      where.status = status;
    }
    if (createdById) {
      where.createdById = createdById;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const createdAtFilter = buildDateRangeFilter(startDate, endDate);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (priceRange === "lt2") {
      where.priceNewAdult = { lt: 2000000 };
    } else if (priceRange === "2to4") {
      where.priceNewAdult = { gte: 2000000, lte: 4000000 };
    } else if (priceRange === "4to8") {
      where.priceNewAdult = { gt: 4000000, lte: 8000000 };
    } else if (priceRange === "gt8") {
      where.priceNewAdult = { gt: 8000000 };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total, trashCount, creators, categories] = await Promise.all([
      prisma.tour.findMany({
        where,
        orderBy: isDeleted
          ? [{ deletedAt: "desc" }, { updatedAt: "desc" }]
          : [{ position: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          updatedBy: { select: { id: true, fullName: true } },
          deletedBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.tour.count({ where }),
      prisma.tour.count({ where: { deleted: true } }),
      prisma.adminAccount.findMany({
        where: { deleted: false },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.category.findMany({
        where: { deleted: false },
        select: { id: true, name: true, parentId: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json({
      items,
      total,
      trashCount,
      page,
      limit,
      creators,
      categories,
    });
  } catch (error) {
    console.error("GET /api/admin/tours error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách tour" },
      { status: 500 }
    );
  }
}

function parseNonNegativeInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const categoryId = String(body.categoryId || "").trim();

    if (!name || !categoryId) {
      return NextResponse.json(
        { message: "Tên tour và danh mục là bắt buộc" },
        { status: 400 }
      );
    }

    const [slug, code] = await Promise.all([
      generateUniqueTourSlug(name),
      body.code ? String(body.code).trim() : generateUniqueTourCode(),
    ]);

    const status: RecordStatus =
      body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const locations = Array.isArray(body.locations)
      ? body.locations.map((v: unknown) => String(v))
      : [];
    const images = Array.isArray(body.images)
      ? body.images.map((v: unknown) => String(v)).filter(Boolean)
      : [];
    const schedules = Array.isArray(body.schedules)
      ? body.schedules.map((s: { title?: unknown; description?: unknown }) => ({
          title: String(s?.title || "").trim(),
          description: String(s?.description || "").trim(),
        }))
      : [];

    const created = await prisma.tour.create({
      data: {
        code,
        name,
        slug,
        categoryId,
        position: Math.max(1, parseNonNegativeInt(body.position, 1)),
        status,
        avatar: body.avatar ? String(body.avatar) : null,
        images,
        priceAdult: parseNonNegativeInt(body.priceAdult),
        priceChild: parseNonNegativeInt(body.priceChild),
        priceBaby: parseNonNegativeInt(body.priceBaby),
        priceNewAdult: parseNonNegativeInt(body.priceNewAdult),
        priceNewChild: parseNonNegativeInt(body.priceNewChild),
        priceNewBaby: parseNonNegativeInt(body.priceNewBaby),
        stockAdult: parseNonNegativeInt(body.stockAdult),
        stockChild: parseNonNegativeInt(body.stockChild),
        stockBaby: parseNonNegativeInt(body.stockBaby),
        locations,
        time: String(body.time || "").trim(),
        vehicle: String(body.vehicle || "").trim(),
        departureDate: body.departureDate
          ? new Date(String(body.departureDate))
          : null,
        information: body.information ? String(body.information) : null,
        schedules,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    revalidateClientToursCache();

    return NextResponse.json(
      { message: "Tạo tour thành công!", item: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/tours error:", error);
    return NextResponse.json(
      { message: "Lỗi khi tạo tour" },
      { status: 500 }
    );
  }
}
