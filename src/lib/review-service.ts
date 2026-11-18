import { OrderStatus, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTourReviewSummary } from "@/lib/ai";
import { revalidateClientToursCache } from "@/lib/cache-tags";
import type { RatingBreakdownMap } from "@/lib/client-data";

/**
 * Fetches active star count distribution (1..5) for a tour.
 */
export async function getTourRatingBreakdown(
  tourId: string
): Promise<RatingBreakdownMap> {
  const grouped = await prisma.review.groupBy({
    by: ["rating"],
    where: {
      tourId,
      deleted: false,
      status: RecordStatus.ACTIVE,
    },
    _count: { rating: true },
  });

  const breakdown: RatingBreakdownMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of grouped) {
    if (row.rating >= 1 && row.rating <= 5) {
      breakdown[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
    }
  }
  return breakdown;
}

/**
 * Checks whether a customer has an active or approved (non-cancelled, non-deleted) booking for a tour.
 */
export async function hasUserBookedTour(
  userId: string,
  tourId: string
): Promise<boolean> {
  if (!userId || !tourId) return false;

  const existing = await prisma.orderItem.findFirst({
    where: {
      tourId,
      order: {
        userId,
        deleted: false,
        status: { not: OrderStatus.CANCELLED },
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

/**
 * Recomputes denormalized tour ratingAvg, reviewCount and regenerates AI Review Summary.
 * Optionally skips Next.js revalidateTag when executed from CLI scripts such as prisma/seed.ts.
 */
export async function syncTourReviewStatsAndSummary(
  tourId: string,
  options?: { revalidate?: boolean }
) {
  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
    select: { id: true, name: true },
  });

  if (!tour) return null;

  const activeReviews = await prisma.review.findMany({
    where: {
      tourId,
      deleted: false,
      status: RecordStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
    select: {
      rating: true,
      comment: true,
      isVerifiedBooking: true,
    },
  });

  const reviewCount = activeReviews.length;
  const ratingAvg =
    reviewCount > 0
      ? Number(
          (
            activeReviews.reduce((acc, item) => acc + item.rating, 0) /
            reviewCount
          ).toFixed(1)
        )
      : 5.0;

  const aiSummary = await buildTourReviewSummary(tour.name, activeReviews);

  await prisma.tour.update({
    where: { id: tourId },
    data: {
      ratingAvg,
      reviewCount,
      aiReviewSummary: aiSummary
        ? (aiSummary as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });

  if (options?.revalidate !== false) {
    try {
      revalidateClientToursCache();
    } catch {
      // Safe no-op outside Next.js request store (e.g. CLI seed scripts)
    }
  }

  return {
    ratingAvg,
    reviewCount,
    aiReviewSummary: aiSummary,
  };
}
