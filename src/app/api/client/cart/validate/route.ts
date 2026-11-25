import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTourIds: unknown[] = Array.isArray(body?.tourIds)
      ? body.tourIds
      : [];

    const tourIds = Array.from(
      new Set(
        rawTourIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      )
    ).slice(0, 20);

    if (tourIds.length === 0) {
      return NextResponse.json({ tours: [] });
    }

    const records = await prisma.tour.findMany({
      where: { id: { in: tourIds } },
      select: {
        id: true,
        slug: true,
        name: true,
        avatar: true,
        priceNewAdult: true,
        priceNewChild: true,
        priceNewBaby: true,
        stockAdult: true,
        stockChild: true,
        stockBaby: true,
        deleted: true,
        status: true,
        category: {
          select: {
            deleted: true,
            status: true,
          },
        },
      },
    });

    const tours = records.map((tour) => ({
      id: tour.id,
      slug: tour.slug,
      name: tour.name,
      avatar: tour.avatar,
      priceNewAdult: tour.priceNewAdult,
      priceNewChild: tour.priceNewChild,
      priceNewBaby: tour.priceNewBaby,
      stockAdult: tour.stockAdult,
      stockChild: tour.stockChild,
      stockBaby: tour.stockBaby,
      active:
        !tour.deleted &&
        tour.status === RecordStatus.ACTIVE &&
        !tour.category.deleted &&
        tour.category.status === RecordStatus.ACTIVE,
    }));

    return NextResponse.json({ tours });
  } catch (error) {
    console.error("POST /api/client/cart/validate error:", error);
    return NextResponse.json(
      { message: "Lỗi đồng bộ thông tin giỏ hàng" },
      { status: 500 }
    );
  }
}
