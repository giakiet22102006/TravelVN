import { NextRequest, NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { syncTourReviewStatsAndSummary } from "@/lib/review-service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search")?.trim();
    const ratingParam = Number(searchParams.get("rating") || 0);
    const statusParam = searchParams.get("status");
    const tourId = searchParams.get("tourId")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 12)));

    const where: Prisma.ReviewWhereInput = { deleted: false };

    if (ratingParam >= 1 && ratingParam <= 5) {
      where.rating = ratingParam;
    }

    if (statusParam === RecordStatus.ACTIVE || statusParam === RecordStatus.INACTIVE) {
      where.status = statusParam;
    }

    if (tourId) {
      where.tourId = tourId;
    }

    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { tour: { name: { contains: search, mode: "insensitive" } } },
        { tour: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatar: true },
          },
          tour: {
            select: { id: true, code: true, name: true, slug: true },
          },
          repliedBy: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/reviews error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách đánh giá" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "REGENERATE_SUMMARY") {
      const tourId = String(body.tourId || "").trim();
      if (!tourId) {
        return NextResponse.json(
          { message: "Thiếu tourId để tạo lại tóm tắt AI" },
          { status: 400 }
        );
      }

      const synced = await syncTourReviewStatsAndSummary(tourId);
      return NextResponse.json({
        message: "Đã cập nhật lại thống kê & tóm tắt AI cho tour!",
        stats: synced,
      });
    }

    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { message: "Vui lòng chọn ít nhất một đánh giá" },
        { status: 400 }
      );
    }

    const targetReviews = await prisma.review.findMany({
      where: { id: { in: ids } },
      select: { tourId: true },
    });
    const affectedTourIds = [...new Set(targetReviews.map((r) => r.tourId))];

    if (action === "ACTIVE" || action === "INACTIVE") {
      await prisma.review.updateMany({
        where: { id: { in: ids } },
        data: { status: action },
      });
    } else if (action === "DELETE") {
      await prisma.review.updateMany({
        where: { id: { in: ids } },
        data: { deleted: true },
      });
    } else {
      return NextResponse.json(
        { message: "Hành động hàng loạt không hợp lệ" },
        { status: 400 }
      );
    }

    await Promise.all(
      affectedTourIds.map((tourId) => syncTourReviewStatsAndSummary(tourId))
    );

    return NextResponse.json({
      message: "Đã cập nhật đánh giá và đồng bộ điểm tour thành công!",
    });
  } catch (error) {
    console.error("PATCH /api/admin/reviews error:", error);
    return NextResponse.json(
      { message: "Lỗi thực hiện thao tác hàng loạt" },
      { status: 500 }
    );
  }
}
