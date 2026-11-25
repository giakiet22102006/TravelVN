import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { releaseExpiredOrderHolds } from "@/lib/order-holds";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await releaseExpiredOrderHolds();

    const body = await req.json();
    const rawTourIds: unknown[] = Array.isArray(body?.tourIds)
      ? body.tourIds
      : [];
    const rawDepartureIds: unknown[] = Array.isArray(body?.departureIds)
      ? body.departureIds
      : [];

    const tourIds = Array.from(
      new Set(
        rawTourIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      )
    ).slice(0, 20);

    const departureIds = Array.from(
      new Set(
        rawDepartureIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      )
    ).slice(0, 20);

    if (tourIds.length === 0 && departureIds.length === 0) {
      return NextResponse.json({ tours: [], departures: [] });
    }

    const [tourRecords, departureRecords] = await Promise.all([
      tourIds.length > 0
        ? prisma.tour.findMany({
            where: { id: { in: tourIds } },
            select: {
              id: true,
              slug: true,
              name: true,
              avatar: true,
              priceAdult: true,
              priceChild: true,
              priceBaby: true,
              priceNewAdult: true,
              priceNewChild: true,
              priceNewBaby: true,
              singleRoomSurcharge: true,
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
          })
        : Promise.resolve([]),
      departureIds.length > 0
        ? prisma.tourDeparture.findMany({
            where: { id: { in: departureIds } },
            select: {
              id: true,
              tourId: true,
              code: true,
              departureDate: true,
              departureLocation: true,
              airline: true,
              flightOut: true,
              flightBack: true,
              priceAdult: true,
              priceChild: true,
              priceBaby: true,
              priceNewAdult: true,
              priceNewChild: true,
              priceNewBaby: true,
              singleRoomSurcharge: true,
              stockAdult: true,
              stockChild: true,
              stockBaby: true,
              status: true,
              tour: {
                select: {
                  slug: true,
                  name: true,
                  avatar: true,
                  deleted: true,
                  status: true,
                  category: {
                    select: {
                      deleted: true,
                      status: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const tours = tourRecords.map((tour) => ({
      id: tour.id,
      slug: tour.slug,
      name: tour.name,
      avatar: tour.avatar,
      priceNewAdult: tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult,
      priceNewChild: tour.priceNewChild > 0 ? tour.priceNewChild : tour.priceChild,
      priceNewBaby: tour.priceNewBaby > 0 ? tour.priceNewBaby : tour.priceBaby,
      singleRoomSurcharge: tour.singleRoomSurcharge,
      stockAdult: tour.stockAdult,
      stockChild: tour.stockChild,
      stockBaby: tour.stockBaby,
      active:
        !tour.deleted &&
        tour.status === RecordStatus.ACTIVE &&
        !tour.category.deleted &&
        tour.category.status === RecordStatus.ACTIVE,
    }));

    const departures = departureRecords.map((dep) => ({
      id: dep.id,
      tourId: dep.tourId,
      code: dep.code,
      slug: dep.tour.slug,
      name: dep.tour.name,
      avatar: dep.tour.avatar,
      departureDate: dep.departureDate.toISOString(),
      departureLocation: dep.departureLocation,
      airline: dep.airline,
      flightOut: dep.flightOut,
      flightBack: dep.flightBack,
      priceNewAdult: dep.priceNewAdult > 0 ? dep.priceNewAdult : dep.priceAdult,
      priceNewChild: dep.priceNewChild > 0 ? dep.priceNewChild : dep.priceChild,
      priceNewBaby: dep.priceNewBaby > 0 ? dep.priceNewBaby : dep.priceBaby,
      singleRoomSurcharge: dep.singleRoomSurcharge,
      stockAdult: dep.stockAdult,
      stockChild: dep.stockChild,
      stockBaby: dep.stockBaby,
      active:
        dep.status === RecordStatus.ACTIVE &&
        !dep.tour.deleted &&
        dep.tour.status === RecordStatus.ACTIVE &&
        !dep.tour.category.deleted &&
        dep.tour.category.status === RecordStatus.ACTIVE,
    }));

    return NextResponse.json({ tours, departures });
  } catch (error) {
    console.error("POST /api/client/cart/validate error:", error);
    return NextResponse.json(
      { message: "Lỗi đồng bộ thông tin giỏ hàng" },
      { status: 500 }
    );
  }
}
