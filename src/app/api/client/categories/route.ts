import { NextResponse } from "next/server";
import { getClientShellData } from "@/lib/client-data";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await getClientShellData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("GET /api/client/categories error:", error);
    return NextResponse.json(
      { message: "Lỗi tải danh mục website" },
      { status: 500 }
    );
  }
}
