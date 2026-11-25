import {
  OrderStatus,
  PaymentStatus,
  type Prisma,
  RecordStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncTourSummaryFromDepartures } from "@/lib/departure-sync";
import { revalidateClientToursCache } from "@/lib/cache-tags";

export const ORDER_HOLD_TTL_MS = 15 * 60 * 1000;

export interface OrderItemInventoryPayload {
  tourId: string | null;
  departureId?: string | null;
  quantityAdult: number;
  quantityChild: number;
  quantityBaby: number;
}

/**
 * Atomically decrements seat stock on a specific `TourDeparture` (if provided)
 * or falls back to the legacy `Tour` row when `departureId` is null.
 * Returns `false` if inventory is insufficient at commit time (TOCTOU safe).
 */
export async function reserveOrderItemStock(
  tx: Prisma.TransactionClient,
  item: {
    tourId: string;
    departureId?: string | null;
    quantityAdult: number;
    quantityChild: number;
    quantityBaby: number;
  }
): Promise<boolean> {
  if (item.departureId) {
    const updated = await tx.tourDeparture.updateMany({
      where: {
        id: item.departureId,
        tourId: item.tourId,
        status: RecordStatus.ACTIVE,
        stockAdult: { gte: item.quantityAdult },
        stockChild: { gte: item.quantityChild },
        stockBaby: { gte: item.quantityBaby },
      },
      data: {
        stockAdult: { decrement: item.quantityAdult },
        stockChild: { decrement: item.quantityChild },
        stockBaby: { decrement: item.quantityBaby },
      },
    });
    if (updated.count === 0) return false;
    await syncTourSummaryFromDepartures(tx, item.tourId);
    return true;
  }

  const updated = await tx.tour.updateMany({
    where: {
      id: item.tourId,
      deleted: false,
      status: RecordStatus.ACTIVE,
      stockAdult: { gte: item.quantityAdult },
      stockChild: { gte: item.quantityChild },
      stockBaby: { gte: item.quantityBaby },
    },
    data: {
      stockAdult: { decrement: item.quantityAdult },
      stockChild: { decrement: item.quantityChild },
      stockBaby: { decrement: item.quantityBaby },
    },
  });
  return updated.count > 0;
}

/**
 * Restores seat inventory inside an open Prisma transaction when an order
 * is cancelled, expires, or is deleted prior to cancellation.
 */
export async function restoreOrderInventoryShared(
  tx: Prisma.TransactionClient,
  items: OrderItemInventoryPayload[]
): Promise<void> {
  const toursToSync = new Set<string>();

  for (const item of items) {
    if (!item.tourId) continue;

    if (item.departureId) {
      const updated = await tx.tourDeparture.updateMany({
        where: { id: item.departureId, tourId: item.tourId },
        data: {
          stockAdult: { increment: item.quantityAdult },
          stockChild: { increment: item.quantityChild },
          stockBaby: { increment: item.quantityBaby },
        },
      });
      if (updated.count > 0) {
        toursToSync.add(item.tourId);
        continue;
      }
    }

    await tx.tour.updateMany({
      where: { id: item.tourId },
      data: {
        stockAdult: { increment: item.quantityAdult },
        stockChild: { increment: item.quantityChild },
        stockBaby: { increment: item.quantityBaby },
      },
    });
  }

  for (const tourId of toursToSync) {
    await syncTourSummaryFromDepartures(tx, tourId);
  }
}

/**
 * Just-in-Time lazy expiration of unpaid online seat holds older than 15 minutes.
 * Safe under concurrent callers: each order transition uses a conditional
 * `updateMany` predicate (`status = INITIAL AND paymentStatus = UNPAID`).
 */
export async function releaseExpiredOrderHolds(opts?: {
  tourId?: string;
  orderCode?: string;
  limit?: number;
}): Promise<number> {
  const now = new Date();
  const candidates = await prisma.order.findMany({
    where: {
      deleted: false,
      status: OrderStatus.INITIAL,
      paymentStatus: PaymentStatus.UNPAID,
      expiresAt: { lt: now },
      ...(opts?.orderCode ? { code: opts.orderCode } : {}),
      ...(opts?.tourId
        ? { items: { some: { tourId: opts.tourId } } }
        : {}),
    },
    select: {
      id: true,
      items: {
        select: {
          tourId: true,
          departureId: true,
          quantityAdult: true,
          quantityChild: true,
          quantityBaby: true,
        },
      },
    },
    orderBy: { expiresAt: "asc" },
    take: opts?.limit ?? 50,
  });

  if (candidates.length === 0) return 0;

  let released = 0;

  for (const candidate of candidates) {
    const transitioned = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id: candidate.id,
          deleted: false,
          status: OrderStatus.INITIAL,
          paymentStatus: PaymentStatus.UNPAID,
          expiresAt: { lt: new Date() },
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: "HOLD_EXPIRED",
        },
      });

      if (claim.count === 0) return false;
      await restoreOrderInventoryShared(tx, candidate.items);
      return true;
    });

    if (transitioned) {
      released++;
    }
  }

  if (released > 0) {
    revalidateClientToursCache();
  }

  return released;
}
