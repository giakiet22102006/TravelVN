import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { validateTourPrices } from "@/lib/admin-api";
import { syncTourSummaryFromDepartures } from "@/lib/departure-sync";
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
    const tour = await prisma.tour.findFirst({
      where: { id, deleted: false },
      select: { id: true, code: true, name: true },
    });

    if (!tour) {
      return NextResponse.json(
        { message: "Không tìm thấy tour" },
        { status: 404 }
      );
    }

    const items = await prisma.tourDeparture.findMany({
      where: { tourId: id },
      orderBy: [{ departureDate: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/admin/tours/[id]/departures error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách lịch khởi hành" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("tour_edit");
    if (auth.error) return auth.error;

    const { id } = await params;
    const tour = await prisma.tour.findFirst({
      where: { id, deleted: false },
      select: { id: true, code: true, hotelStar: true },
    });

    if (!tour) {
      return NextResponse.json(
        { message: "Không tìm thấy tour" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const departureDateRaw = String(body.departureDate || "").trim();
    const departureDate = departureDateRaw ? new Date(departureDateRaw) : null;

    if (!departureDate || Number.isNaN(departureDate.getTime())) {
      return NextResponse.json(
        { message: "Ngày khởi hành không hợp lệ" },
        { status: 400 }
      );
    }

    const returnDateRaw = body.returnDate ? String(body.returnDate).trim() : "";
    const returnDate = returnDateRaw ? new Date(returnDateRaw) : null;
    if (returnDate && Number.isNaN(returnDate.getTime())) {
      return NextResponse.json(
        { message: "Ngày về không hợp lệ" },
        { status: 400 }
      );
    }

    const departureLocation =
      String(body.departureLocation || "").trim() || "Hà Nội";

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

    const customCode = String(body.code || "")
      .trim()
      .toUpperCase();
    const dateStamp = departureDate.toISOString().slice(2, 10).replace(/-/g, "");
    let finalCode = customCode || `${tour.code}-${dateStamp}`;

    if (!customCode) {
      let seq = 1;
      while (true) {
        const exists = await prisma.tourDeparture.findUnique({
          where: { code: finalCode },
          select: { id: true },
        });
        if (!exists) break;
        finalCode = `${tour.code}-${dateStamp}-${seq++}`;
      }
    } else {
      const exists = await prisma.tourDeparture.findUnique({
        where: { code: finalCode },
        select: { id: true },
      });
      if (exists) {
        return NextResponse.json(
          { message: `Mã lịch khởi hành "${finalCode}" đã tồn tại` },
          { status: 409 }
        );
      }
    }

    const status: RecordStatus =
      body.status === RecordStatus.INACTIVE
        ? RecordStatus.INACTIVE
        : RecordStatus.ACTIVE;

    const hotelStarRaw = parseNonNegativeInt(body.hotelStar, tour.hotelStar);
    const hotelStar = Math.max(1, Math.min(5, hotelStarRaw));

    const created = await prisma.$transaction(async (tx) => {
      const dep = await tx.tourDeparture.create({
        data: {
          tourId: id,
          code: finalCode,
          departureDate,
          returnDate,
          departureLocation,
          airline: body.airline ? String(body.airline).trim() : null,
          flightOut: body.flightOut ? String(body.flightOut).trim() : null,
          flightBack: body.flightBack ? String(body.flightBack).trim() : null,
          hotelStar,
          priceAdult: parseNonNegativeInt(body.priceAdult),
          priceChild: parseNonNegativeInt(body.priceChild),
          priceBaby: parseNonNegativeInt(body.priceBaby),
          priceNewAdult: parseNonNegativeInt(body.priceNewAdult),
          priceNewChild: parseNonNegativeInt(body.priceNewChild),
          priceNewBaby: parseNonNegativeInt(body.priceNewBaby),
          singleRoomSurcharge: parseNonNegativeInt(
            body.singleRoomSurcharge,
            500000
          ),
          stockAdult: parseNonNegativeInt(body.stockAdult, 20),
          stockChild: parseNonNegativeInt(body.stockChild, 10),
          stockBaby: parseNonNegativeInt(body.stockBaby, 5),
          status,
        },
      });

      await syncTourSummaryFromDepartures(tx, id);
      return dep;
    });

    revalidateClientToursCache();

    return NextResponse.json(
      {
        message: "Tạo lịch khởi hành thành công!",
        item: created,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Mã lịch khởi hành đã tồn tại" },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/tours/[id]/departures error:", error);
    return NextResponse.json(
      { message: "Lỗi tạo lịch khởi hành" },
      { status: 500 }
    );
  }
}
