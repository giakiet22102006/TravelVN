import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { syncTourReviewStatsAndSummary } from "@/lib/review-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.review.findFirst({
      where: { id, deleted: false },
      select: { id: true, tourId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy đánh giá" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: {
      status?: RecordStatus;
      adminReply?: string | null;
      repliedAt?: Date | null;
      repliedById?: string | null;
    } = {};

    if (body.status === RecordStatus.ACTIVE || body.status === RecordStatus.INACTIVE) {
      updateData.status = body.status;
    }

    if ("adminReply" in body) {
      const replyText = body.adminReply ? String(body.adminReply).trim() : "";
      updateData.adminReply = replyText || null;
      updateData.repliedAt = replyText ? new Date() : null;
      updateData.repliedById = replyText ? admin.id : null;
    }

    const updated = await prisma.review.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        user: { select: { id: true, fullName: true, email: true, avatar: true } },
        tour: { select: { id: true, code: true, name: true, slug: true } },
        repliedBy: { select: { id: true, fullName: true } },
      },
    });

    await syncTourReviewStatsAndSummary(existing.tourId);

    return NextResponse.json({
      message: "Đã cập nhật đánh giá thành công!",
      item: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/reviews/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi cập nhật đánh giá" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.review.findFirst({
      where: { id, deleted: false },
      select: { id: true, tourId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy đánh giá" },
        { status: 404 }
      );
    }

    await prisma.review.update({
      where: { id: existing.id },
      data: { deleted: true },
    });

    await syncTourReviewStatsAndSummary(existing.tourId);

    return NextResponse.json({ message: "Đã xóa đánh giá thành công!" });
  } catch (error) {
    console.error("DELETE /api/admin/reviews/[id] error:", error);
    return NextResponse.json(
      { message: "Lỗi xóa đánh giá" },
      { status: 500 }
    );
  }
}
