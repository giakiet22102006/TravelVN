import { NextRequest, NextResponse } from "next/server";
import { queryClientTours } from "@/lib/client-data";
import { getCurrentUser } from "@/lib/client-auth";
import { askTravelAssistant } from "@/lib/ai";
import type { AssistantPageContext } from "@/lib/ai-tools";

export const dynamic = "force-dynamic";

function sanitizePageContext(raw: unknown): AssistantPageContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pathname = typeof r.pathname === "string" ? r.pathname.slice(0, 200) : "/";
  const allowedTypes = new Set([
    "home",
    "tours-catalog",
    "tour-detail",
    "cart",
    "other",
  ]);
  const pageType =
    typeof r.pageType === "string" && allowedTypes.has(r.pageType)
      ? (r.pageType as AssistantPageContext["pageType"])
      : "other";

  const filtersRaw =
    r.filters && typeof r.filters === "object"
      ? (r.filters as Record<string, unknown>)
      : undefined;

  return {
    pageType,
    pathname,
    tourSlug:
      typeof r.tourSlug === "string" && r.tourSlug.trim()
        ? r.tourSlug.trim().slice(0, 180)
        : undefined,
    tourCode:
      typeof r.tourCode === "string" && r.tourCode.trim()
        ? r.tourCode.trim().slice(0, 40)
        : undefined,
    filters: filtersRaw
      ? {
          category:
            typeof filtersRaw.category === "string"
              ? filtersRaw.category.slice(0, 80)
              : undefined,
          destination:
            typeof filtersRaw.destination === "string"
              ? filtersRaw.destination.slice(0, 80)
              : undefined,
          priceRange:
            typeof filtersRaw.priceRange === "string"
              ? filtersRaw.priceRange.slice(0, 40)
              : undefined,
          dealOnly:
            typeof filtersRaw.dealOnly === "boolean"
              ? filtersRaw.dealOnly
              : undefined,
        }
      : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();
    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const pageContext = sanitizePageContext(body.pageContext);

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
      .slice(-8);

    const [{ tours }, currentUser] = await Promise.all([
      queryClientTours({ limit: 50 }),
      getCurrentUser(),
    ]);
    const response = await askTravelAssistant(message, history, tours, {
      pageContext,
      currentUser,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("POST /api/client/ai/chat error:", error);
    return NextResponse.json(
      { message: "Trợ lý AI đang bận, vui lòng thử lại sau ít giây." },
      { status: 500 }
    );
  }
}
