import { NextRequest, NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/client-auth";
import { askTravelAssistant, type AssistantTourContext } from "@/lib/ai";
import type { AssistantPageContext } from "@/lib/ai-tools";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

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

async function loadActiveToursWithDepartures(): Promise<AssistantTourContext[]> {
  const rows = await prisma.tour.findMany({
    where: {
      deleted: false,
      status: RecordStatus.ACTIVE,
      category: { deleted: false, status: RecordStatus.ACTIVE },
    },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      avatar: true,
      priceAdult: true,
      priceNewAdult: true,
      priceNewChild: true,
      priceNewBaby: true,
      stockAdult: true,
      stockChild: true,
      stockBaby: true,
      locations: true,
      time: true,
      vehicle: true,
      departureDate: true,
      ratingAvg: true,
      reviewCount: true,
      durationDays: true,
      hotelStar: true,
      singleRoomSurcharge: true,
      tags: true,
      category: {
        select: { id: true, name: true, slug: true },
      },
      departures: {
        where: { status: RecordStatus.ACTIVE },
        orderBy: [{ departureDate: "asc" }],
        select: {
          id: true,
          tourId: true,
          code: true,
          departureDate: true,
          returnDate: true,
          departureLocation: true,
          airline: true,
          flightOut: true,
          flightBack: true,
          hotelStar: true,
          priceAdult: true,
          priceChild: true,
          priceBaby: true,
          priceNewAdult: true,
          priceNewChild: true,
          priceNewBaby: true,
          singleRoomSurcharge: true,
          stockAdult: true,
          stockChild: true,
          stockBaby: true,
        },
      },
    },
  });

  return rows.map((t) => ({
    ...t,
    departureDate: t.departureDate ? t.departureDate.toISOString() : null,
    departures: t.departures.map((d) => ({
      ...d,
      departureDate: d.departureDate.toISOString(),
      returnDate: d.returnDate ? d.returnDate.toISOString() : null,
    })),
  }));
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`ai-chat:${ip}`, 15, 60 * 1000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(
        rl.retryAfterSec,
        "Bạn gửi tin nhắn quá nhanh, vui lòng đợi một lát rồi thử lại."
      );
    }

    const body = await req.json();
    const message = String(body.message || "").trim();
    const rawHistory: unknown[] = Array.isArray(body.history)
      ? body.history
      : [];
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
      .slice(-12)
      .map((item: { role: "user" | "assistant"; content: string }) => ({
        role: item.role,
        content: item.content.slice(0, 1000),
      }));

    const [tours, currentUser] = await Promise.all([
      loadActiveToursWithDepartures(),
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
