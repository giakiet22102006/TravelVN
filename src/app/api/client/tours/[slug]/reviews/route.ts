import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { moderateReviewContent } from "@/lib/ai";
import {
  getTourRatingBreakdown,
  hasUserBookedTour,
  syncTourReviewStatsAndSummary,
} from "@/lib/review-service";

export const dynamic = "force-dynamic";

async function findActiveTourBySlugOrId(slugOrId: string) {
  return prisma.tour.findFirst({
    where: {
      deleted: false,
      status: RecordStatus.ACTIVE,
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      ratingAvg: true,
      reviewCount: true,
      aiReviewSummary: true,
    },
  });
}

function serializeReview(review: {
  id: string;
  tourId: string;
  userId: string;
  rating: number;
  comment: string;
  isVerifiedBooking: boolean;
  aiSentiment: string;
  adminReply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  user: { id: string; fullName: string; avatar: string | null };
}) {
  return {
    ...review,
    repliedAt: review.repliedAt ? review.repliedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const tour = await findActiveTourBySlugOrId(slug);
    if (!tour) {
      return NextResponse.json(
        { message: "Không tìm thấy tour" },
        { status: 404 }
      );
    }

    const { searchParams } = req.nextUrl;
    const ratingRaw = searchParams.get("rating") || "";
    const validRatings = Array.from(
      new Set(
        ratingRaw
          .split(",")
          .map((part) => Number(part.trim()))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
      )
    );
    const verifiedOnly = searchParams.get("verified") === "true";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") || 10)));

    const where: Prisma.ReviewWhereInput = {
      tourId: tour.id,
      deleted: false,
      status: RecordStatus.ACTIVE,
      ...(validRatings.length === 1
        ? { rating: validRatings[0] }
        : validRatings.length > 1
          ? { rating: { in: validRatings } }
          : {}),
      ...(verifiedOnly ? { isVerifiedBooking: true } : {}),
    };

    const [reviews, totalFiltered, ratingBreakdown, viewer] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          tourId: true,
          userId: true,
          rating: true,
          comment: true,
          isVerifiedBooking: true,
          aiSentiment: true,
          adminReply: true,
          repliedAt: true,
          createdAt: true,
          user: {
            select: { id: true, fullName: true, avatar: true },
          },
        },
      }),
      prisma.review.count({ where }),
      getTourRatingBreakdown(tour.id),
      getCurrentUser(),
    ]);

    let viewerState: {
      isLoggedIn: boolean;
      isVerifiedBooking: boolean;
      existingReviewId: string | null;
    } = {
      isLoggedIn: false,
      isVerifiedBooking: false,
      existingReviewId: null,
    };

    if (viewer) {
      const [isVerifiedBooking, existingReview] = await Promise.all([
        hasUserBookedTour(viewer.id, tour.id),
        prisma.review.findFirst({
          where: {
            tourId: tour.id,
            userId: viewer.id,
            deleted: false,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        }),
      ]);

      viewerState = {
        isLoggedIn: true,
        isVerifiedBooking,
        existingReviewId: existingReview?.id ?? null,
      };
    }

    return NextResponse.json({
      reviews: reviews.map(serializeReview),
      totalFiltered,
      page,
      limit,
      stats: {
        ratingAvg: tour.ratingAvg,
        reviewCount: tour.reviewCount,
        ratingBreakdown,
        aiReviewSummary: tour.aiReviewSummary,
      },
      viewerState,
    });
  } catch (error) {
    console.error("GET /api/client/tours/[slug]/reviews error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách đánh giá" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để gửi đánh giá" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const tour = await findActiveTourBySlugOrId(slug);
    if (!tour) {
      return NextResponse.json(
        { message: "Không tìm thấy tour hoặc tour đã ngừng hoạt động" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const rating = Math.round(Number(body.rating));
    const comment = String(body.comment || "").trim();
    const reviewId = body.reviewId ? String(body.reviewId).trim() : "";

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { message: "Số sao đánh giá phải từ 1 đến 5" },
        { status: 400 }
      );
    }

    if (comment.length < 10 || comment.length > 1500) {
      return NextResponse.json(
        { message: "Nội dung bình luận cần dài từ 10 đến 1500 ký tự" },
        { status: 400 }
      );
    }

    // AI Feature #1: Auto-Moderation before persisting review
    const moderation = await moderateReviewContent(comment, rating);
    if (!moderation.allowed) {
      return NextResponse.json(
        {
          code: "AI_MODERATION_BLOCKED",
          message:
            moderation.reason ||
            "Nội dung đánh giá chưa phù hợp tiêu chuẩn cộng đồng.",
          source: moderation.source,
        },
        { status: 422 }
      );
    }

    const isVerifiedBooking = await hasUserBookedTour(user.id, tour.id);

    let savedReview;
    if (reviewId) {
      const existing = await prisma.review.findFirst({
        where: { id: reviewId, tourId: tour.id, userId: user.id, deleted: false },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { message: "Không tìm thấy đánh giá để cập nhật" },
          { status: 404 }
        );
      }

      savedReview = await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating,
          comment,
          isVerifiedBooking,
          aiSentiment: moderation.sentiment,
          status: RecordStatus.ACTIVE,
        },
        select: {
          id: true,
          tourId: true,
          userId: true,
          rating: true,
          comment: true,
          isVerifiedBooking: true,
          aiSentiment: true,
          adminReply: true,
          repliedAt: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, avatar: true } },
        },
      });
    } else {
      savedReview = await prisma.review.create({
        data: {
          tourId: tour.id,
          userId: user.id,
          rating,
          comment,
          isVerifiedBooking,
          aiSentiment: moderation.sentiment,
          status: RecordStatus.ACTIVE,
        },
        select: {
          id: true,
          tourId: true,
          userId: true,
          rating: true,
          comment: true,
          isVerifiedBooking: true,
          aiSentiment: true,
          adminReply: true,
          repliedAt: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, avatar: true } },
        },
      });
    }

    // Recompute denormalized stats + AI Review Summary + invalidate cache
    const [syncedStats, ratingBreakdown] = await Promise.all([
      syncTourReviewStatsAndSummary(tour.id),
      getTourRatingBreakdown(tour.id),
    ]);

    return NextResponse.json(
      {
        message: "Cảm ơn bạn! Đánh giá đã được đăng ngay.",
        review: serializeReview(savedReview),
        moderationSource: moderation.source,
        stats: {
          ratingAvg: syncedStats?.ratingAvg ?? rating,
          reviewCount: syncedStats?.reviewCount ?? 1,
          ratingBreakdown,
          aiReviewSummary: syncedStats?.aiReviewSummary ?? null,
        },
      },
      { status: reviewId ? 200 : 201 }
    );
  } catch (error) {
    console.error("POST /api/client/tours/[slug]/reviews error:", error);
    return NextResponse.json(
      { message: "Không thể gửi đánh giá lúc này. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
