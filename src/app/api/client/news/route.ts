import { NextRequest, NextResponse } from "next/server";
import { queryClientNews } from "@/lib/client-data";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category")?.trim() || undefined;
    const keyword = searchParams.get("keyword")?.trim() || undefined;
    const page = Number(searchParams.get("page") || 1) || 1;
    const limit = Number(searchParams.get("limit") || 9) || 9;

    const result = await queryClientNews({ category, keyword, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/client/news error:", error);
    return NextResponse.json(
      { message: "Không thể tải danh sách tin tức" },
      { status: 500 }
    );
  }
}
