import { type Prisma, RecordStatus } from "@prisma/client";

/**
 * Synchronizes denormalized summary fields on `Tour` (lowest active price,
 * earliest upcoming departure date, aggregate seat capacity, distinct locations)
 * from its active `TourDeparture` rows inside an open Prisma transaction.
 *
 * Legacy tours without any `TourDeparture` rows are left untouched so backward
 * compatibility is preserved.
 */
export async function syncTourSummaryFromDepartures(
  tx: Prisma.TransactionClient,
  tourId: string
): Promise<void> {
  const activeDepartures = await tx.tourDeparture.findMany({
    where: { tourId, status: RecordStatus.ACTIVE },
    orderBy: [{ departureDate: "asc" }],
  });

  if (activeDepartures.length === 0) {
    return;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const futureDepartures = activeDepartures.filter(
    (d) => d.departureDate >= startOfToday
  );
  const pool = futureDepartures.length > 0 ? futureDepartures : activeDepartures;

  const effectivePrice = (d: (typeof pool)[number]) =>
    d.priceNewAdult > 0 ? d.priceNewAdult : d.priceAdult;

  let lowestPriceDep = pool[0];
  for (const dep of pool) {
    if (effectivePrice(dep) < effectivePrice(lowestPriceDep)) {
      lowestPriceDep = dep;
    }
  }

  const nextAvailableDep =
    pool.find((d) => d.stockAdult > 0) ?? pool[0];

  const totalStockAdult = pool.reduce(
    (sum, d) => sum + Math.max(0, d.stockAdult),
    0
  );
  const totalStockChild = pool.reduce(
    (sum, d) => sum + Math.max(0, d.stockChild),
    0
  );
  const totalStockBaby = pool.reduce(
    (sum, d) => sum + Math.max(0, d.stockBaby),
    0
  );

  const distinctLocations = Array.from(
    new Set(
      pool
        .map((d) => d.departureLocation.trim())
        .filter(Boolean)
    )
  );

  await tx.tour.update({
    where: { id: tourId },
    data: {
      priceAdult: lowestPriceDep.priceAdult,
      priceChild: lowestPriceDep.priceChild,
      priceBaby: lowestPriceDep.priceBaby,
      priceNewAdult: lowestPriceDep.priceNewAdult,
      priceNewChild: lowestPriceDep.priceNewChild,
      priceNewBaby: lowestPriceDep.priceNewBaby,
      singleRoomSurcharge: lowestPriceDep.singleRoomSurcharge,
      hotelStar: lowestPriceDep.hotelStar,
      departureDate: nextAvailableDep.departureDate,
      stockAdult: totalStockAdult,
      stockChild: totalStockChild,
      stockBaby: totalStockBaby,
      ...(distinctLocations.length > 0 ? { locations: distinctLocations } : {}),
    },
  });
}
