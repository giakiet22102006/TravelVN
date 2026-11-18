import { NextRequest, NextResponse } from "next/server";
import { queryClientTours } from "@/lib/client-data";
import { askTravelAssistant } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();
    const rawHistory = Array.isArray(body.history) ? body.history : [];

    if (!message || message.length > 500) {
      return NextResponse.json(
        { message: "Câu hỏi cần có độ dài từ 1 đến 500 ký tự" },
        { status: 400 }
      );
    }

    const history = rawHistory
      .filter(
        (item: unknown): item is { role: "user" | "assistant"; content: string } => {
          if (item === null || typeof item !== "object") return false;
          const record = item as Record<string, unknown>;
          return (
            (record.role === "user" || record.role === "assistant") &&
            typeof record.content === "string"
          );
        }
      )
      .slice(-6);

    const { tours } = await queryClientTours({ limit: 50 });
    const response = await askTravelAssistant(message, history, tours);

    return NextResponse.json(response);
  } catch (error) {
    console.error("POST /api/client/ai/chat error:", error);
    return NextResponse.json(
      { message: "Trợ lý AI đang bận, vui lòng thử lại sau ít giây." },
      { status: 500 }
    );
  }
}
