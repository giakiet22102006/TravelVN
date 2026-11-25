import { NextRequest, NextResponse } from "next/server";
import { processSignedPaymentWebhook } from "@/lib/payment-webhook";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-webhook-signature") || "";
    const result = await processSignedPaymentWebhook(rawBody, signatureHeader);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/webhooks/payment error:", error);
    return NextResponse.json(
      { message: "Lỗi xử lý webhook thanh toán" },
      { status: 500 }
    );
  }
}
