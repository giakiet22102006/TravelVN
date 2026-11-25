import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { getClientToursByLookups } from "@/lib/client-data";

export const dynamic = "force-dynamic";

async function loadUserWishlist(userId: string) {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { tourId: true },
  });
  const ids = rows.map((r) => r.tourId);
  const tours = await getClientToursByLookups({ ids });
  return {
    tourIds: tours.map((t) => t.id),
    tours,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để xem danh sách yêu thích" },
        { status: 401 }
      );
    }

    const payload = await loadUserWishlist(user.id);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/client/wishlist error:", error);
    return NextResponse.json(
      { message: "Không thể tải danh sách tour yêu thích" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập để lưu tour yêu thích" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    if (Array.isArray(body.mergeTourIds)) {
      const candidateIds: string[] = Array.from(
        new Set(
          (body.mergeTourIds as unknown[])
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .map((x) => x.trim())
        )
      ).slice(0, 50);

      if (candidateIds.length > 0) {
        const validTours = await prisma.tour.findMany({
          where: {
            id: { in: candidateIds },
            deleted: false,
            status: RecordStatus.ACTIVE,
          },
          select: { id: true },
        });

        if (validTours.length > 0) {
          await prisma.wishlistItem.createMany({
            data: validTours.map((t) => ({
              userId: user.id,
              tourId: t.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      const payload = await loadUserWishlist(user.id);
      return NextResponse.json({ action: "merged", ...payload });
    }

    const tourId = typeof body.tourId === "string" ? body.tourId.trim() : "";
    if (!tourId) {
      return NextResponse.json(
        { message: "Thiếu mã tour cần lưu" },
        { status: 400 }
      );
    }

    const existing = await prisma.wishlistItem.findUnique({
      where: {
        userId_tourId: {
          userId: user.id,
          tourId,
        },
      },
    });

    let action: "added" | "removed" = "added";
    if (existing) {
      await prisma.wishlistItem.delete({
        where: { id: existing.id },
      });
      action = "removed";
    } else {
      const tour = await prisma.tour.findFirst({
        where: {
          id: tourId,
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!tour) {
        return NextResponse.json(
          { message: "Tour không tồn tại hoặc đã ngừng phục vụ" },
          { status: 404 }
        );
      }

      await prisma.wishlistItem.create({
        data: {
          userId: user.id,
          tourId: tour.id,
        },
      });
      action = "added";
    }

    const payload = await loadUserWishlist(user.id);
    return NextResponse.json({ action, ...payload });
  } catch (error) {
    console.error("POST /api/client/wishlist error:", error);
    return NextResponse.json(
      { message: "Không thể cập nhật danh sách yêu thích" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    const tourId = req.nextUrl.searchParams.get("tourId")?.trim() || "";
    if (!tourId) {
      return NextResponse.json(
        { message: "Thiếu tourId cần xóa" },
        { status: 400 }
      );
    }

    await prisma.wishlistItem.deleteMany({
      where: {
        userId: user.id,
        tourId,
      },
    });

    const payload = await loadUserWishlist(user.id);
    return NextResponse.json({ action: "removed", ...payload });
  } catch (error) {
    console.error("DELETE /api/client/wishlist error:", error);
    return NextResponse.json(
      { message: "Không thể xóa tour khỏi danh sách yêu thích" },
      { status: 500 }
    );
  }
}
