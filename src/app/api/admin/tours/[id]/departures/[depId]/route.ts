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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const auth = await requireAdmin("tour_edit");
    if (auth.error) return auth.error;

    const { id, depId } = await params;
    const existing = await prisma.tourDeparture.findFirst({
      where: { id: depId, tourId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy lịch khởi hành" },
        { status: 404 }
      );
    }

    const body = await req.json();

    const departureDateRaw = String(body.departureDate || "").trim();
    const departureDate = departureDateRaw
      ? new Date(departureDateRaw)
      : existing.departureDate;
    if (Number.isNaN(departureDate.getTime())) {
      return NextResponse.json(
        { message: "Ngày khởi hành không hợp lệ" },
        { status: 400 }
      );
    }

    let returnDate: Date | null = existing.returnDate;
    if (body.returnDate !== undefined) {
      const returnRaw = body.returnDate ? String(body.returnDate).trim() : "";
      returnDate = returnRaw ? new Date(returnRaw) : null;
      if (returnDate && Number.isNaN(returnDate.getTime())) {
        return NextResponse.json(
          { message: "Ngày về không hợp lệ" },
          { status: 400 }
        );
      }
    }

    const rawPrices = {
      priceAdult: Number(body.priceAdult ?? existing.priceAdult),
      priceChild: Number(body.priceChild ?? existing.priceChild),
      priceBaby: Number(body.priceBaby ?? existing.priceBaby),
      priceNewAdult: Number(body.priceNewAdult ?? existing.priceNewAdult),
      priceNewChild: Number(body.priceNewChild ?? existing.priceNewChild),
      priceNewBaby: Number(body.priceNewBaby ?? existing.priceNewBaby),
    };
    const priceError = validateTourPrices(rawPrices);
    if (priceError) {
      return NextResponse.json({ message: priceError }, { status: 400 });
    }

    const nextCode = body.code
      ? String(body.code).trim().toUpperCase()
      : existing.code;

    if (nextCode !== existing.code) {
      const dup = await prisma.tourDeparture.findUnique({
        where: { code: nextCode },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { message: `Mã lịch khởi hành "${nextCode}" đã tồn tại` },
          { status: 409 }
        );
      }
    }

    const status: RecordStatus =
      body.status === RecordStatus.INACTIVE
        ? RecordStatus.INACTIVE
        : RecordStatus.ACTIVE;

    const hotelStarRaw = parseNonNegativeInt(
      body.hotelStar,
      existing.hotelStar
    );
    const hotelStar = Math.max(1, Math.min(5, hotelStarRaw));

    const updated = await prisma.$transaction(async (tx) => {
      const dep = await tx.tourDeparture.update({
        where: { id: depId },
        data: {
          code: nextCode,
          departureDate,
          returnDate,
          departureLocation:
            String(body.departureLocation || "").trim() ||
            existing.departureLocation,
          airline:
            body.airline !== undefined
              ? body.airline
                ? String(body.airline).trim()
                : null
              : existing.airline,
          flightOut:
            body.flightOut !== undefined
              ? body.flightOut
                ? String(body.flightOut).trim()
                : null
              : existing.flightOut,
          flightBack:
            body.flightBack !== undefined
              ? body.flightBack
                ? String(body.flightBack).trim()
                : null
              : existing.flightBack,
          hotelStar,
          priceAdult: parseNonNegativeInt(body.priceAdult, existing.priceAdult),
          priceChild: parseNonNegativeInt(body.priceChild, existing.priceChild),
          priceBaby: parseNonNegativeInt(body.priceBaby, existing.priceBaby),
          priceNewAdult: parseNonNegativeInt(
            body.priceNewAdult,
            existing.priceNewAdult
          ),
          priceNewChild: parseNonNegativeInt(
            body.priceNewChild,
            existing.priceNewChild
          ),
          priceNewBaby: parseNonNegativeInt(
            body.priceNewBaby,
            existing.priceNewBaby
          ),
          singleRoomSurcharge: parseNonNegativeInt(
            body.singleRoomSurcharge,
            existing.singleRoomSurcharge
          ),
          stockAdult: parseNonNegativeInt(body.stockAdult, existing.stockAdult),
          stockChild: parseNonNegativeInt(body.stockChild, existing.stockChild),
          stockBaby: parseNonNegativeInt(body.stockBaby, existing.stockBaby),
          status,
        },
      });

      await syncTourSummaryFromDepartures(tx, id);
      return dep;
    });

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Cập nhật lịch khởi hành thành công!",
      item: updated,
    });
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
    console.error("PUT /api/admin/tours/[id]/departures/[depId] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật lịch khởi hành" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const auth = await requireAdmin("tour_edit");
    if (auth.error) return auth.error;

    const { id, depId } = await params;
    const existing = await prisma.tourDeparture.findFirst({
      where: { id: depId, tourId: id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy lịch khởi hành" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tourDeparture.delete({
        where: { id: depId },
      });
      await syncTourSummaryFromDepartures(tx, id);
    });

    revalidateClientToursCache();

    return NextResponse.json({
      message: "Đã xóa lịch khởi hành!",
    });
  } catch (error) {
    console.error(
      "DELETE /api/admin/tours/[id]/departures/[depId] error:",
      error
    );
    return NextResponse.json(
      { message: "Lỗi xóa lịch khởi hành" },
      { status: 500 }
    );
  }
}
