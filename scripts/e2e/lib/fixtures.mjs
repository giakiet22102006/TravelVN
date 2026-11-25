import { PrismaClient, RecordStatus } from "@prisma/client";
import { loadProjectEnv } from "./env.mjs";
import { uniqueTag } from "./http.mjs";

let prismaInstance = null;

export function getPrisma() {
  if (!prismaInstance) {
    loadProjectEnv();
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

export async function snapshotStock(prisma) {
  const [departures, tours] = await Promise.all([
    prisma.tourDeparture.findMany({
      select: {
        id: true,
        tourId: true,
        code: true,
        stockAdult: true,
        stockChild: true,
        stockBaby: true,
      },
    }),
    prisma.tour.findMany({
      select: {
        id: true,
        code: true,
        stockAdult: true,
        stockChild: true,
        stockBaby: true,
      },
    }),
  ]);

  return {
    departures: new Map(departures.map((d) => [d.id, d])),
    tours: new Map(tours.map((t) => [t.id, t])),
  };
}

export async function verifyStockSnapshot(
  prisma,
  snapshot,
  ignoredTourIds = new Set()
) {
  const current = await snapshotStock(prisma);
  const drifts = [];

  for (const [id, before] of snapshot.departures.entries()) {
    if (ignoredTourIds.has(before.tourId)) continue;
    const after = current.departures.get(id);
    if (!after) {
      drifts.push(`Departure ${before.code} (${id}) missing after run`);
      continue;
    }
    if (
      after.stockAdult !== before.stockAdult ||
      after.stockChild !== before.stockChild ||
      after.stockBaby !== before.stockBaby
    ) {
      drifts.push(
        `Departure ${before.code} stock drift: before=(${before.stockAdult},${before.stockChild},${before.stockBaby}) after=(${after.stockAdult},${after.stockChild},${after.stockBaby})`
      );
    }
  }

  for (const [id, before] of snapshot.tours.entries()) {
    if (ignoredTourIds.has(id)) continue;
    const after = current.tours.get(id);
    if (!after) {
      drifts.push(`Tour ${before.code} (${id}) missing after run`);
      continue;
    }
    if (
      after.stockAdult !== before.stockAdult ||
      after.stockChild !== before.stockChild ||
      after.stockBaby !== before.stockBaby
    ) {
      drifts.push(
        `Tour ${before.code} stock drift: before=(${before.stockAdult},${before.stockChild},${before.stockBaby}) after=(${after.stockAdult},${after.stockChild},${after.stockBaby})`
      );
    }
  }

  if (drifts.length > 0) {
    throw new Error(`Stock drift detected:\n- ${drifts.join("\n- ")}`);
  }
}

export async function discoverFixtures(prisma) {
  const activeTours = await prisma.tour.findMany({
    where: {
      deleted: false,
      status: RecordStatus.ACTIVE,
      category: { deleted: false, status: RecordStatus.ACTIVE },
    },
    include: {
      departures: {
        where: {
          status: RecordStatus.ACTIVE,
          stockAdult: { gte: 4 },
        },
        orderBy: [{ departureDate: "asc" }],
      },
    },
    orderBy: [{ code: "asc" }],
  });

  const candidates = [];
  for (const tour of activeTours) {
    if (tour.departures.length > 0) {
      for (const dep of tour.departures) {
        const unitAdult =
          dep.priceNewAdult > 0 ? dep.priceNewAdult : dep.priceAdult;
        candidates.push({
          tour,
          departure: dep,
          unitAdult,
          departureLocation: dep.departureLocation,
        });
      }
    } else if (tour.stockAdult >= 4) {
      const unitAdult =
        tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;
      const locs = Array.isArray(tour.locations) ? tour.locations : [];
      candidates.push({
        tour,
        departure: null,
        unitAdult,
        departureLocation: String(locs[0] || "Hà Nội"),
      });
    }
  }

  const category = await prisma.category.findFirst({
    where: { deleted: false, status: RecordStatus.ACTIVE },
    orderBy: [{ position: "asc" }],
  });

  if (!category) {
    throw new Error("No active Category found in DB for E2E fixtures");
  }

  const midTier =
    candidates.find(
      (c) => c.unitAdult >= 2_000_000 && c.unitAdult < 8_000_000
    ) || candidates.find((c) => c.unitAdult >= 2_000_000);
  const vipTier =
    candidates.find((c) => c.unitAdult >= 8_000_000) ||
    candidates.find((c) => c.unitAdult >= 4_000_000);
  const tenMTier =
    candidates.find(
      (c) => c.unitAdult === 10_000_000 && c.departure?.stockAdult >= 4
    ) ||
    candidates.find((c) => c.unitAdult >= 10_000_000) ||
    vipTier;

  if (!midTier || !vipTier || !tenMTier) {
    throw new Error(
      "Could not discover sufficient active Tour/Departure fixtures with stockAdult >= 4"
    );
  }

  return {
    category,
    candidates,
    midTier,
    vipTier,
    tenMTier,
  };
}

async function syncTourSummaryFromDeparturesTx(tx, tourId) {
  const activeDepartures = await tx.tourDeparture.findMany({
    where: { tourId, status: RecordStatus.ACTIVE },
    orderBy: [{ departureDate: "asc" }],
  });

  if (activeDepartures.length === 0) return;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const futureDepartures = activeDepartures.filter(
    (d) => d.departureDate >= startOfToday
  );
  const pool = futureDepartures.length > 0 ? futureDepartures : activeDepartures;

  const effectivePrice = (d) =>
    d.priceNewAdult > 0 ? d.priceNewAdult : d.priceAdult;
  let lowestPriceDep = pool[0];
  for (const dep of pool) {
    if (effectivePrice(dep) < effectivePrice(lowestPriceDep)) {
      lowestPriceDep = dep;
    }
  }
  const nextAvailableDep = pool.find((d) => d.stockAdult > 0) ?? pool[0];

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
    new Set(pool.map((d) => d.departureLocation.trim()).filter(Boolean))
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

export function makePassengers(count, tier = "ADULT", prefix = "E2E Hành Khách") {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      fullName: `${prefix} ${i}`,
      gender: i % 2 === 0 ? "FEMALE" : "MALE",
      birthDate:
        tier === "ADULT"
          ? "1992-05-15"
          : tier === "CHILD"
            ? "2018-06-01"
            : "2024-09-01",
      tier,
    });
  }
  return list;
}

export function makeOrderPayload({
  fixture,
  tourId,
  departureId,
  departureLocation,
  quantityAdult = 1,
  quantityChild = 0,
  quantityBaby = 0,
  singleRoomCount = 0,
  fullName = "E2E Khách Hàng",
  phone = "0912345678",
  email = "e2e@test.travelvn.local",
  couponCode,
  paymentMethod = "CASH",
  redeemPoints,
  saveTravelers,
  passengers,
  agreedTerms = true,
  note = null,
}) {
  const resolvedTourId = tourId ?? fixture.tour.id;
  const resolvedDepId =
    departureId !== undefined ? departureId : fixture.departure?.id ?? null;
  const resolvedLoc =
    departureLocation ?? fixture?.departureLocation ?? "Hà Nội";

  const resolvedPassengers = passengers ?? [
    ...makePassengers(quantityAdult, "ADULT", "E2E Người Lớn"),
    ...makePassengers(quantityChild, "CHILD", "E2E Trẻ Em"),
    ...makePassengers(quantityBaby, "BABY", "E2E Em Bé"),
  ];

  const payload = {
    fullName,
    phone,
    email,
    agreedTerms,
    note,
    paymentMethod,
    passengers: resolvedPassengers,
    items: [
      {
        tourId: resolvedTourId,
        ...(resolvedDepId ? { departureId: resolvedDepId } : {}),
        departureLocation: resolvedLoc,
        quantityAdult,
        quantityChild,
        quantityBaby,
        singleRoomCount,
      },
    ],
  };

  if (couponCode !== undefined) payload.couponCode = couponCode;
  if (redeemPoints !== undefined) payload.redeemPoints = redeemPoints;
  if (saveTravelers !== undefined) payload.saveTravelers = saveTravelers;

  return payload;
}

export function createTracker(prisma, categoryId) {
  const userIds = new Set();
  const orderIds = new Set();
  const orderCodes = new Set();
  const eventIds = new Set();
  const travelerIds = new Set();
  const tourIds = new Set();
  const departureIds = new Set();

  return {
    trackUser(id) {
      if (id) userIds.add(id);
    },
    trackOrder(order) {
      if (!order) return;
      if (typeof order === "string") {
        orderIds.add(order);
        return;
      }
      if (order.id) orderIds.add(order.id);
      if (order.code) orderCodes.add(order.code);
      if (order.userId) userIds.add(order.userId);
    },
    trackOrderCode(code) {
      if (code) orderCodes.add(code);
    },
    trackEventId(id) {
      if (id) eventIds.add(id);
    },
    trackTraveler(id) {
      if (id) travelerIds.add(id);
    },
    trackTour(id) {
      if (id) tourIds.add(id);
    },
    trackDeparture(id) {
      if (id) departureIds.add(id);
    },

    async createEphemeralTour({
      priceNewAdult = 1_500_000,
      priceNewChild = 750_000,
      priceNewBaby = 250_000,
      stockAdult = 20,
      stockChild = 10,
      stockBaby = 5,
      singleRoomSurcharge = 300_000,
      departureLocation = "Hà Nội",
    } = {}) {
      const tag = uniqueTag("E2ETOUR").toUpperCase();
      const depDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const tour = await prisma.tour.create({
        data: {
          code: tag.slice(0, 24),
          name: `Tour E2E ${tag}`,
          slug: `tour-${tag.toLowerCase()}`,
          categoryId,
          status: RecordStatus.ACTIVE,
          deleted: false,
          priceAdult: priceNewAdult,
          priceChild: priceNewChild,
          priceBaby: priceNewBaby,
          priceNewAdult,
          priceNewChild,
          priceNewBaby,
          singleRoomSurcharge,
          stockAdult,
          stockChild,
          stockBaby,
          departureDate: depDate,
          locations: [departureLocation],
          departures: {
            create: {
              code: `DEP-${tag.slice(-10)}`,
              departureDate: depDate,
              departureLocation,
              priceAdult: priceNewAdult,
              priceChild: priceNewChild,
              priceBaby: priceNewBaby,
              priceNewAdult,
              priceNewChild,
              priceNewBaby,
              singleRoomSurcharge,
              stockAdult,
              stockChild,
              stockBaby,
              status: RecordStatus.ACTIVE,
            },
          },
        },
        include: {
          departures: true,
        },
      });
      tourIds.add(tour.id);
      const departure = tour.departures[0];
      if (departure) departureIds.add(departure.id);
      return {
        tour,
        departure,
        unitAdult: priceNewAdult,
        departureLocation,
      };
    },

    async cleanup() {
      const uIds = Array.from(userIds);
      const oIds = Array.from(orderIds);
      const oCodes = Array.from(orderCodes);
      const eIds = Array.from(eventIds);
      const tIds = Array.from(travelerIds);
      const epTourIds = Array.from(tourIds);
      const epDepIds = Array.from(departureIds);

      if (
        uIds.length === 0 &&
        oIds.length === 0 &&
        oCodes.length === 0 &&
        eIds.length === 0 &&
        tIds.length === 0 &&
        epTourIds.length === 0 &&
        epDepIds.length === 0
      ) {
        return;
      }

      const orderFilterOr = [];
      if (oIds.length > 0) orderFilterOr.push({ id: { in: oIds } });
      if (oCodes.length > 0) orderFilterOr.push({ code: { in: oCodes } });
      if (uIds.length > 0) orderFilterOr.push({ userId: { in: uIds } });

      const orders =
        orderFilterOr.length > 0
          ? await prisma.order.findMany({
              where: { OR: orderFilterOr },
              include: { items: true },
            })
          : [];

      const allOrderIds = Array.from(
        new Set([...oIds, ...orders.map((o) => o.id)])
      );
      const allOrderCodes = Array.from(
        new Set([...oCodes, ...orders.map((o) => o.code)])
      );

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await prisma.$transaction(async (tx) => {
            const affectedTourIds = new Set();

            for (const order of orders) {
              if (order.status === "CANCELLED" || order.deleted) continue;
              for (const item of order.items) {
                if (!item.tourId || tourIds.has(item.tourId)) continue;
                if (item.departureId && !departureIds.has(item.departureId)) {
                  await tx.tourDeparture.updateMany({
                    where: { id: item.departureId },
                    data: {
                      stockAdult: { increment: item.quantityAdult },
                      stockChild: { increment: item.quantityChild },
                      stockBaby: { increment: item.quantityBaby },
                    },
                  });
                  affectedTourIds.add(item.tourId);
                } else {
                  await tx.tour.updateMany({
                    where: { id: item.tourId },
                    data: {
                      stockAdult: { increment: item.quantityAdult },
                      stockChild: { increment: item.quantityChild },
                      stockBaby: { increment: item.quantityBaby },
                    },
                  });
                }
              }
            }

            for (const tid of affectedTourIds) {
              await syncTourSummaryFromDeparturesTx(tx, tid);
            }

            const loyaltyOr = [];
            if (uIds.length > 0) loyaltyOr.push({ userId: { in: uIds } });
            if (allOrderIds.length > 0) {
              loyaltyOr.push({ orderId: { in: allOrderIds } });
            }
            if (loyaltyOr.length > 0) {
              await tx.loyaltyTransaction.deleteMany({
                where: { OR: loyaltyOr },
              });
            }

            const webhookOr = [];
            if (eIds.length > 0) webhookOr.push({ eventId: { in: eIds } });
            if (allOrderCodes.length > 0) {
              webhookOr.push({ orderCode: { in: allOrderCodes } });
            }
            if (webhookOr.length > 0) {
              await tx.paymentWebhookLog.deleteMany({
                where: { OR: webhookOr },
              });
            }

            const travelerOr = [];
            if (uIds.length > 0) travelerOr.push({ userId: { in: uIds } });
            if (tIds.length > 0) travelerOr.push({ id: { in: tIds } });
            if (travelerOr.length > 0) {
              await tx.savedTraveler.deleteMany({
                where: { OR: travelerOr },
              });
            }

            if (uIds.length > 0) {
              await tx.wishlistItem.deleteMany({
                where: { userId: { in: uIds } },
              });
              await tx.review.deleteMany({
                where: { userId: { in: uIds } },
              });
            }

            if (allOrderIds.length > 0) {
              await tx.orderItem.deleteMany({
                where: { orderId: { in: allOrderIds } },
              });
              await tx.order.deleteMany({
                where: { id: { in: allOrderIds } },
              });
            }

            if (epDepIds.length > 0) {
              await tx.tourDeparture.deleteMany({
                where: { id: { in: epDepIds } },
              });
            }
            if (epTourIds.length > 0) {
              await tx.tour.deleteMany({
                where: { id: { in: epTourIds } },
              });
            }

            if (uIds.length > 0) {
              await tx.user.deleteMany({
                where: { id: { in: uIds } },
              });
            }
          });
          break;
        } catch (err) {
          if (err?.code === "P2034" && attempt < 2) continue;
          throw err;
        }
      }

      userIds.clear();
      orderIds.clear();
      orderCodes.clear();
      eventIds.clear();
      travelerIds.clear();
      tourIds.clear();
      departureIds.clear();
    },
  };
}
