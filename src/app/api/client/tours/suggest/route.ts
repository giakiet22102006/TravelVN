import { NextRequest, NextResponse } from "next/server";
import {
  getClientToursByLookups,
  suggestToursAndDestinations,
} from "@/lib/client-data";

export const dynamic = "force-dynamic";

function parseListParam(values: string[]): string[] {
  return values
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const slugs = parseListParam(searchParams.getAll("slugs"));
    const ids = parseListParam(searchParams.getAll("ids"));

    if (slugs.length > 0 || ids.length > 0) {
      const tours = await getClientToursByLookups({ slugs, ids });
      return NextResponse.json({ tours });
    }

    const q = (searchParams.get("q") ?? searchParams.get("keyword") ?? "").trim();
    const result = await suggestToursAndDestinations(q, 6);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/client/tours/suggest error:", error);
    return NextResponse.json(
      { message: "Lỗi tải gợi ý tìm kiếm tour" },
      { status: 500 }
    );
  }
}
