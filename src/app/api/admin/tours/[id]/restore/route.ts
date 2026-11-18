import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateClientToursCache } from "@/lib/cache-tags";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin("tour_trash");
    if (auth.error) return auth.error;
    const { admin } = auth;

    const { id } = await params;
    await prisma.tour.update({
      where: { id },
      data: {
        deleted: false,
        deletedById: null,
        deletedAt: null,
        updatedById: admin.id,
      },
    });

    revalidateClientToursCache();

    return NextResponse.json({ message: "Khôi phục tour thành công!" });
  } catch (error) {
    console.error("POST /api/admin/tours/[id]/restore error:", error);
    return NextResponse.json(
      { message: "Lỗi khi khôi phục tour" },
      { status: 500 }
    );
  }
}
