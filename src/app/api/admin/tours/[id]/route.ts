import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateUniqueTourSlug, validateTourPrices } from "@/lib/admin-api";
import { revalidateClientToursCache } from "@/lib/cache-tags";

function parseNonNegativeInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(["tour_view", "tour_edit"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const item = await prisma.tour.findFirst({
      where: { id, deleted: false },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Không tìm thấy tour" },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("GET /api/admin/tours/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải thông tin tour" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("tour_edit");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    const existing = await prisma.tour.findFirst({
      where: { id, deleted: false },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy tour" },
        { status: 404 }
      );
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

    const rawPrices = {
      priceAdult: Number(body.priceAdult ?? 0),
      priceChild: Number(body.priceChild ?? 0),
      priceBaby: Number(body.priceBaby ?? 0),
      priceNewAdult: Number(body.priceNewAdult ?? 0),
      priceNewChild: Number(body.priceNewChild ?? 0),
      priceNewBaby: Number(body.priceNewBaby ?? 0),
    };
    const priceError = validateTourPrices(rawPrices);
    if (priceError) {
      return NextResponse.json({ message: priceError }, { status: 400 });
    }

    const slug =
      name !== existing.name
        ? await generateUniqueTourSlug(name, id)
        : existing.slug;

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

    const updated = await prisma.tour.update({
      where: { id },
      data: {
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
        updatedById: admin.id,
      },
    });

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Cập nhật tour thành công!",
      item: updated,
    });
  } catch (error) {
    console.error("PUT /api/admin/tours/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật tour" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("tour_delete");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    await prisma.tour.update({
      where: { id },
      data: {
        deleted: true,
        deletedById: admin.id,
        deletedAt: new Date(),
      },
    });

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Đã chuyển tour vào thùng rác!",
    });
  } catch (error) {
    console.error("DELETE /api/admin/tours/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi khi xóa tour" },
      { status: 500 }
    );
  }
}
