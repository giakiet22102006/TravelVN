import { NextRequest, NextResponse } from "next/server";
import { getClientTourBySlug } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const data = await getClientTourBySlug(slug);

    if (!data) {
      return NextResponse.json(
        { message: "Không tìm thấy tour hoặc tour đã ngừng hoạt động" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/client/tours/[slug] error:", error);
    return NextResponse.json(
      { message: "Lỗi tải chi tiết tour" },
      { status: 500 }
    );
  }
}
