import { NextRequest, NextResponse } from "next/server";
import { queryClientTours } from "@/lib/client-data";

export const dynamic = "force-dynamic";

function parsePositiveInt(val: string | null, fallback = 0): number {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const dealParam = searchParams.get("deal")?.trim().toLowerCase();

    const result = await queryClientTours({
      categorySlug: searchParams.get("category") || undefined,
      keyword: searchParams.get("keyword") || undefined,
      destination: searchParams.get("destination") || undefined,
      departureLocation: searchParams.get("departureLocation") || undefined,
      departureDate: searchParams.get("departureDate") || undefined,
      adult: parsePositiveInt(searchParams.get("adult"), 0),
      child: parsePositiveInt(searchParams.get("child"), 0),
      baby: parsePositiveInt(searchParams.get("baby"), 0),
      priceRange: searchParams.get("priceRange") || undefined,
      dealOnly: dealParam === "true" || dealParam === "1",
      sort: searchParams.get("sort") || undefined,
      page: parsePositiveInt(searchParams.get("page"), 1),
      limit: parsePositiveInt(searchParams.get("limit"), 9),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/client/tours error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh sách tour" },
      { status: 500 }
    );
  }
}
