import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredOrderHolds } from "@/lib/order-holds";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (cronSecret) {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { message: "Unauthorized cron request" },
          { status: 401 }
        );
      }
    }

    const released = await releaseExpiredOrderHolds({ limit: 200 });
    return NextResponse.json({ ok: true, released });
  } catch (error) {
    console.error("GET /api/cron/expire-orders error:", error);
    return NextResponse.json(
      { message: "Lỗi xử lý hết hạn giữ chỗ" },
      { status: 500 }
    );
  }
}
