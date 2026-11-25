import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrencyVND, formatDateVN, slugify } from "@/lib/format";
import { ACTIVE_COUPONS } from "@/lib/knowledge/coupons";
import { SUPPORT_CONTACT, TRAVELVN_POLICIES } from "@/lib/knowledge/policies";
import type { ClientUserPublic } from "@/lib/client-auth";
import type { AssistantTourContext } from "@/lib/ai";
import { TOUR_TAG_LABELS, type TourDeparturePublic } from "@/types/ota";

export interface AssistantPageContext {
  pageType: "home" | "tours-catalog" | "tour-detail" | "cart" | "other";
  pathname: string;
  tourSlug?: string;
  tourCode?: string;
  filters?: {
    category?: string;
    destination?: string;
    priceRange?: string;
    dealOnly?: boolean;
  };
}

const BEACH_KEYWORDS = [
  "bien",
  "dao",
  "phu quoc",
  "nha trang",
  "da nang",
  "ha long",
  "quy nhon",
  "con dao",
  "vung tau",
  "phan thiet",
  "mui ne",
  "cat ba",
  "ly son",
  "vinh",
];

const MOUNTAIN_KEYWORDS = [
  "nui",
  "sapa",
  "sa pa",
  "da lat",
  "ha giang",
  "fansipan",
  "moc chau",
  "ninh binh",
  "tam dao",
  "ba na",
  "yen tu",
  "cao nguyen",
  "san may",
];

const FOREIGN_KEYWORDS = [
  "nuoc ngoai",
  "quoc te",
  "chau a",
  "chau au",
  "nhat ban",
  "han quoc",
  "thai lan",
  "singapore",
  "trung quoc",
  "dai loan",
  "phap",
  "thuy si",
  "y ",
  "tokyo",
  "kyoto",
  "paris",
];

const NORTH_KEYWORDS = [
  "mien bac",
  "tay bac",
  "dong bac",
  "ha noi",
  "sapa",
  "sa pa",
  "lao cai",
  "fansipan",
  "ha long",
  "ninh binh",
  "yen tu",
  "ha giang",
  "moc chau",
  "tam dao",
  "cat ba",
];

const CENTRAL_KEYWORDS = [
  "mien trung",
  "da nang",
  "hoi an",
  "ba na",
  "hue",
  "quy nhon",
  "nha trang",
  "da lat",
  "phu yen",
];

const SOUTH_KEYWORDS = [
  "mien nam",
  "phu quoc",
  "con dao",
  "vung tau",
  "can tho",
  "mien tay",
  "tp hcm",
  "sai gon",
];

export function buildTourDestinationHaystack(tour: AssistantTourContext): string {
  return slugify(
    [
      tour.name,
      tour.code,
      tour.slug,
      tour.category?.name || tour.categoryName || "",
    ].join(" ")
  ).replace(/-/g, " ");
}

export function isBeachTour(tour: AssistantTourContext): boolean {
  const hay = buildTourDestinationHaystack(tour);
  if (
    MOUNTAIN_KEYWORDS.some((kw) => hay.includes(kw)) &&
    !hay.includes("ha long") &&
    !hay.includes("nha trang") &&
    !hay.includes("phu quoc") &&
    !hay.includes("da nang")
  ) {
    return false;
  }
  return BEACH_KEYWORDS.some((kw) => hay.includes(kw));
}

export function isMountainTour(tour: AssistantTourContext): boolean {
  const hay = buildTourDestinationHaystack(tour);
  return MOUNTAIN_KEYWORDS.some((kw) => hay.includes(kw));
}

export function isForeignTour(tour: AssistantTourContext): boolean {
  const hay = buildTourDestinationHaystack(tour);
  return FOREIGN_KEYWORDS.some((kw) => hay.includes(kw));
}

export function isNorthTour(tour: AssistantTourContext): boolean {
  if (isForeignTour(tour)) return false;
  const hay = buildTourDestinationHaystack(tour);
  return NORTH_KEYWORDS.some((kw) => hay.includes(kw));
}

export function isCentralTour(tour: AssistantTourContext): boolean {
  if (isForeignTour(tour)) return false;
  const hay = buildTourDestinationHaystack(tour);
  return CENTRAL_KEYWORDS.some((kw) => hay.includes(kw));
}

export function isSouthTour(tour: AssistantTourContext): boolean {
  if (isForeignTour(tour)) return false;
  const hay = buildTourDestinationHaystack(tour);
  return SOUTH_KEYWORDS.some((kw) => hay.includes(kw));
}

export function detectGuardrailViolation(
  message: string
): { blocked: true; reply: string } | { blocked: false } {
  const normalized = slugify(message).replace(/-/g, " ");

  const promptInjectionPatterns = [
    "system prompt",
    "ignore previous",
    "bo qua huong dan",
    "quen het quy tac",
    "reveal your prompt",
    "in ra prompt",
    "xem prompt",
    "api key",
    "gemini api",
    "database_url",
    "mat khau admin",
    "danh sach khach hang",
    "so dien thoai khach",
    "email khach hang",
    "don hang cua nguoi khac",
    "tat ca don hang",
  ];

  if (promptInjectionPatterns.some((p) => normalized.includes(p))) {
    return {
      blocked: true,
      reply:
        "Xin lỗi, vì lý do bảo mật và quyền riêng tư của khách hàng VN.TRAVEL, mình không thể tiết lộ cấu hình hệ thống, thông tin nội bộ hoặc dữ liệu cá nhân/đơn hàng của khách hàng khác. Mình có thể hỗ trợ bạn tìm tour, xem lịch trình, mã giảm giá hoặc chính sách hoàn/hủy nhé!",
    };
  }

  return { blocked: false };
}

export interface SearchToursArgs {
  keyword?: string;
  themeTag?:
    | "bien"
    | "nui"
    | "nuoc-ngoai"
    | "trong-nuoc"
    | "mien-bac"
    | "mien-trung"
    | "mien-nam"
    | "tat-ca";
  maxPriceVND?: number;
  minPriceVND?: number;
  departureLocation?: string;
  dealOnly?: boolean;
  sortBy?: "price-asc" | "price-desc" | "rating-desc" | "discount-desc";
  limit?: number;
}

function filterByThemeAndKeyword(
  tours: AssistantTourContext[],
  themeTag?: SearchToursArgs["themeTag"],
  keyword?: string
): AssistantTourContext[] {
  let filtered = [...tours];

  if (themeTag === "bien") {
    filtered = filtered.filter((t) => isBeachTour(t));
  } else if (themeTag === "nui") {
    filtered = filtered.filter((t) => isMountainTour(t));
  } else if (themeTag === "nuoc-ngoai") {
    filtered = filtered.filter((t) => isForeignTour(t));
  } else if (themeTag === "trong-nuoc") {
    filtered = filtered.filter((t) => !isForeignTour(t));
  } else if (themeTag === "mien-bac") {
    filtered = filtered.filter((t) => isNorthTour(t));
  } else if (themeTag === "mien-trung") {
    filtered = filtered.filter((t) => isCentralTour(t));
  } else if (themeTag === "mien-nam") {
    filtered = filtered.filter((t) => isSouthTour(t));
  }

  if (keyword && keyword.trim()) {
    const kwNorm = slugify(keyword).replace(/-/g, " ");
    const tokens = kwNorm
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 2 &&
          !["tour", "du", "lich", "di", "gia", "dinh"].includes(w)
      );
    if (tokens.length > 0) {
      const keywordMatched = filtered.filter((t) => {
        const hay = buildTourDestinationHaystack(t);
        return tokens.every((tok) => hay.includes(tok));
      });
      if (keywordMatched.length > 0) {
        filtered = keywordMatched;
      } else {
        filtered = filtered.filter((t) => {
          const hay = buildTourDestinationHaystack(t);
          return tokens.some((tok) => hay.includes(tok));
        });
      }
    }
  }

  return filtered;
}

export function executeSearchTours(
  args: SearchToursArgs,
  tours: AssistantTourContext[]
): {
  totalMatched: number;
  tours: Array<{
    slug: string;
    code: string;
    name: string;
    category: string;
    priceAdultVND: number;
    originalPriceVND: number;
    duration: string;
    vehicle: string;
    departures: string[];
    ratingAvg: number;
    reviewCount: number;
  }>;
  matchedContexts: AssistantTourContext[];
} {
  let filtered = filterByThemeAndKeyword(tours, args.themeTag, args.keyword);

  if (args.maxPriceVND && args.maxPriceVND > 0) {
    filtered = filtered.filter((t) => {
      const price = t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
      return price <= args.maxPriceVND!;
    });
  }

  if (args.minPriceVND && args.minPriceVND > 0) {
    filtered = filtered.filter((t) => {
      const price = t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
      return price >= args.minPriceVND!;
    });
  }

  if (args.departureLocation && args.departureLocation.trim()) {
    const depNorm = slugify(args.departureLocation).replace(/-/g, " ");
    filtered = filtered.filter((t) => {
      const depLocs =
        t.departures && t.departures.length > 0
          ? t.departures.map((d) =>
              slugify(d.departureLocation).replace(/-/g, " ")
            )
          : Array.isArray(t.locations)
            ? t.locations.map((l) => slugify(String(l)).replace(/-/g, " "))
            : [];
      return depLocs.some((l) => l.includes(depNorm) || depNorm.includes(l));
    });
  }

  if (args.dealOnly) {
    filtered = filtered.filter(
      (t) =>
        t.priceAdult > 0 && t.priceNewAdult > 0 && t.priceNewAdult < t.priceAdult
    );
  }

  if (args.sortBy === "price-asc") {
    filtered.sort(
      (a, b) => (a.priceNewAdult || a.priceAdult) - (b.priceNewAdult || b.priceAdult)
    );
  } else if (args.sortBy === "price-desc") {
    filtered.sort(
      (a, b) => (b.priceNewAdult || b.priceAdult) - (a.priceNewAdult || a.priceAdult)
    );
  } else if (args.sortBy === "rating-desc") {
    filtered.sort(
      (a, b) =>
        (b.ratingAvg ?? 5) - (a.ratingAvg ?? 5) ||
        (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
    );
  } else if (args.sortBy === "discount-desc") {
    filtered.sort((a, b) => {
      const pctA =
        a.priceAdult > 0 && a.priceNewAdult > 0
          ? (a.priceAdult - a.priceNewAdult) / a.priceAdult
          : 0;
      const pctB =
        b.priceAdult > 0 && b.priceNewAdult > 0
          ? (b.priceAdult - b.priceNewAdult) / b.priceAdult
          : 0;
      return pctB - pctA;
    });
  }

  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 8);
  const sliced = filtered.slice(0, limit);

  return {
    totalMatched: filtered.length,
    tours: sliced.map((t) => ({
      slug: t.slug,
      code: t.code,
      name: t.name,
      category: t.category?.name || t.categoryName || "",
      priceAdultVND: t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult,
      originalPriceVND: t.priceAdult,
      duration: t.time,
      vehicle: t.vehicle || "",
      departures: Array.isArray(t.locations)
        ? t.locations.map((x) => String(x))
        : [],
      ratingAvg: t.ratingAvg ?? 5,
      reviewCount: t.reviewCount ?? 0,
    })),
    matchedContexts: sliced,
  };
}

export interface FindDeparturesWithQuoteArgs {
  keyword?: string;
  themeTag?: SearchToursArgs["themeTag"];
  adults?: number;
  children?: number;
  babies?: number;
  singleRooms?: number;
  maxTotalBudgetVND?: number;
  departureLocation?: string;
  departureMonth?: string;
  limit?: number;
}

export function executeFindDeparturesWithQuote(
  args: FindDeparturesWithQuoteArgs,
  tours: AssistantTourContext[]
): {
  totalMatched: number;
  passengers: {
    adults: number;
    children: number;
    babies: number;
    singleRooms: number;
  };
  quotes: Array<{
    slug: string;
    code: string;
    name: string;
    departureId?: string;
    departureCode?: string;
    departureDate: string;
    departureLocation: string;
    duration: string;
    priceAdultVND: number;
    priceChildVND: number;
    priceBabyVND: number;
    singleRoomSurchargeVND: number;
    quoteTotalVND: number;
    quoteSummary: string;
    remainingAdultStock: number;
  }>;
  matchedContexts: AssistantTourContext[];
} {
  const adults = Math.max(1, Math.floor(Number(args.adults) || 1));
  const children = Math.max(0, Math.floor(Number(args.children) || 0));
  const babies = Math.max(0, Math.floor(Number(args.babies) || 0));
  const singleRooms = Math.max(0, Math.floor(Number(args.singleRooms) || 0));

  const candidates = filterByThemeAndKeyword(
    tours,
    args.themeTag,
    args.keyword
  );

  const normDepLoc = args.departureLocation
    ? slugify(args.departureLocation).replace(/-/g, " ")
    : "";
  const monthPrefix =
    args.departureMonth && /^\d{4}-\d{2}$/.test(args.departureMonth.trim())
      ? args.departureMonth.trim()
      : "";

  const nowMs = Date.now() - 24 * 3600 * 1000;

  interface QuotedEntry {
    tour: AssistantTourContext;
    dep: TourDeparturePublic | null;
    adultUnit: number;
    childUnit: number;
    babyUnit: number;
    surcharge: number;
    quoteTotalVND: number;
    quoteSummary: string;
    depLocation: string;
    depDateStr: string | null;
    stockAdult: number;
    stockChild: number;
    stockBaby: number;
  }

  const results: QuotedEntry[] = [];

  for (const tour of candidates) {
    const deps = Array.isArray(tour.departures) ? tour.departures : [];
    let chosenDep: TourDeparturePublic | null = null;

    if (deps.length > 0) {
      const matchingDeps = deps.filter((d) => {
        if (normDepLoc) {
          const dLoc = slugify(d.departureLocation).replace(/-/g, " ");
          if (!dLoc.includes(normDepLoc) && !normDepLoc.includes(dLoc)) {
            return false;
          }
        }
        if (monthPrefix) {
          if (!d.departureDate.startsWith(monthPrefix)) return false;
        }
        if (d.stockAdult < adults) return false;
        if (d.stockChild < children) return false;
        if (d.stockBaby < babies) return false;
        return true;
      });

      if (matchingDeps.length === 0) continue;

      const upcoming = matchingDeps.find(
        (d) => new Date(d.departureDate).getTime() >= nowMs
      );
      chosenDep = upcoming || matchingDeps[0];
    } else {
      if (normDepLoc) {
        const locs = Array.isArray(tour.locations)
          ? tour.locations.map((l) => slugify(String(l)).replace(/-/g, " "))
          : [];
        if (!locs.some((l) => l.includes(normDepLoc) || normDepLoc.includes(l))) {
          continue;
        }
      }
      if (monthPrefix) {
        const dtStr = tour.departureDate
          ? new Date(tour.departureDate).toISOString().slice(0, 7)
          : "";
        if (dtStr !== monthPrefix) continue;
      }
      if ((tour.stockAdult ?? 10) < adults) continue;
      if ((tour.stockChild ?? 5) < children) continue;
      if ((tour.stockBaby ?? 5) < babies) continue;
    }

    const adultUnit = chosenDep
      ? chosenDep.priceNewAdult > 0
        ? chosenDep.priceNewAdult
        : chosenDep.priceAdult
      : tour.priceNewAdult > 0
        ? tour.priceNewAdult
        : tour.priceAdult;

    const childUnit = chosenDep
      ? chosenDep.priceNewChild > 0
        ? chosenDep.priceNewChild
        : chosenDep.priceChild
      : (tour.priceNewChild ?? 0) > 0
        ? tour.priceNewChild!
        : Math.round(adultUnit * 0.7);

    const babyUnit = chosenDep
      ? chosenDep.priceNewBaby > 0
        ? chosenDep.priceNewBaby
        : chosenDep.priceBaby
      : tour.priceNewBaby ?? 0;

    const surcharge = chosenDep
      ? chosenDep.singleRoomSurcharge
      : tour.singleRoomSurcharge ?? 500_000;

    const quoteTotalVND =
      adults * adultUnit +
      children * childUnit +
      babies * babyUnit +
      singleRooms * surcharge;

    if (
      args.maxTotalBudgetVND &&
      args.maxTotalBudgetVND > 0 &&
      quoteTotalVND > args.maxTotalBudgetVND
    ) {
      continue;
    }

    const paxParts = [`${adults} NL`];
    if (children > 0) paxParts.push(`${children} TE`);
    if (babies > 0) paxParts.push(`${babies} EB`);
    if (singleRooms > 0) paxParts.push(`${singleRooms} P.đơn`);

    const quoteSummary = `${paxParts.join(", ")} · Tổng ${formatCurrencyVND(
      quoteTotalVND
    )}`;

    const fallbackLoc =
      Array.isArray(tour.locations) && tour.locations[0]
        ? String(tour.locations[0])
        : "Hà Nội";

    results.push({
      tour,
      dep: chosenDep,
      adultUnit,
      childUnit,
      babyUnit,
      surcharge,
      quoteTotalVND,
      quoteSummary,
      depLocation: chosenDep?.departureLocation || fallbackLoc,
      depDateStr: chosenDep?.departureDate
        ? chosenDep.departureDate
        : tour.departureDate
          ? new Date(tour.departureDate).toISOString()
          : null,
      stockAdult: chosenDep?.stockAdult ?? tour.stockAdult ?? 10,
      stockChild: chosenDep?.stockChild ?? tour.stockChild ?? 5,
      stockBaby: chosenDep?.stockBaby ?? tour.stockBaby ?? 5,
    });
  }

  results.sort(
    (a, b) =>
      a.quoteTotalVND - b.quoteTotalVND ||
      (b.tour.ratingAvg ?? 5) - (a.tour.ratingAvg ?? 5)
  );

  const limit = Math.min(Math.max(Number(args.limit) || 4, 1), 6);
  const sliced = results.slice(0, limit);

  const matchedContexts: AssistantTourContext[] = sliced.map((entry) => ({
    ...entry.tour,
    priceNewAdult: entry.adultUnit,
    priceNewChild: entry.childUnit,
    priceNewBaby: entry.babyUnit,
    stockAdult: entry.stockAdult,
    stockChild: entry.stockChild,
    stockBaby: entry.stockBaby,
    departureDate: entry.depDateStr,
    nextDepartureId: entry.dep?.id,
    nextDepartureLocation: entry.depLocation,
    quoteTotalVND: entry.quoteTotalVND,
    quoteSummary: entry.quoteSummary,
    quoteAdults: adults,
    quoteChildren: children,
    quoteBabies: babies,
  }));

  return {
    totalMatched: results.length,
    passengers: { adults, children, babies, singleRooms },
    quotes: sliced.map((entry) => ({
      slug: entry.tour.slug,
      code: entry.tour.code,
      name: entry.tour.name,
      departureId: entry.dep?.id,
      departureCode: entry.dep?.code,
      departureDate: formatDateVN(entry.depDateStr),
      departureLocation: entry.depLocation,
      duration: entry.tour.time,
      priceAdultVND: entry.adultUnit,
      priceChildVND: entry.childUnit,
      priceBabyVND: entry.babyUnit,
      singleRoomSurchargeVND: entry.surcharge,
      quoteTotalVND: entry.quoteTotalVND,
      quoteSummary: entry.quoteSummary,
      remainingAdultStock: entry.stockAdult,
    })),
    matchedContexts,
  };
}

export function executeCompareTours(
  args: { tourCodesOrSlugs?: string[] },
  tours: AssistantTourContext[]
): {
  foundCount: number;
  comparisonText: string;
  tours: Array<{
    code: string;
    slug: string;
    name: string;
    priceAdultVND: number;
    priceChildVND: number;
    duration: string;
    hotelStar: number;
    vehicle: string;
    departures: string[];
    ratingAvg: number;
    reviewCount: number;
    tags: string[];
  }>;
  matchedContexts: AssistantTourContext[];
} {
  const inputs = Array.isArray(args.tourCodesOrSlugs)
    ? args.tourCodesOrSlugs.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const matchedMap = new Map<string, AssistantTourContext>();

  for (const raw of inputs) {
    const norm = slugify(raw).replace(/-/g, " ");
    const exact = tours.find(
      (t) =>
        t.code.toLowerCase() === raw.toLowerCase() ||
        t.slug.toLowerCase() === raw.toLowerCase()
    );
    if (exact) {
      matchedMap.set(exact.id, exact);
      continue;
    }
    const partial = tours.find((t) =>
      buildTourDestinationHaystack(t).includes(norm)
    );
    if (partial) {
      matchedMap.set(partial.id, partial);
    }
  }

  const matched = Array.from(matchedMap.values()).slice(0, 4);

  if (matched.length === 0) {
    return {
      foundCount: 0,
      comparisonText:
        "Không tìm thấy tour khớp mã hoặc tên để so sánh. Bạn hãy cung cấp tên điểm đến hoặc mã tour cụ thể nhé.",
      tours: [],
      matchedContexts: [],
    };
  }

  const comparisonLines = matched.map((t, idx) => {
    const adultPrice = t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
    const childPrice =
      (t.priceNewChild ?? 0) > 0
        ? t.priceNewChild!
        : Math.round(adultPrice * 0.7);
    const locs =
      Array.isArray(t.locations) && t.locations.length > 0
        ? t.locations.map(String).join(", ")
        : "Hà Nội";
    const tagNames = Array.isArray(t.tags)
      ? t.tags.map((tag) => TOUR_TAG_LABELS[String(tag)] || String(tag))
      : [];
    const stars = t.hotelStar ? `${t.hotelStar}★` : "Tiêu chuẩn";
    const ratingStr =
      (t.reviewCount ?? 0) > 0
        ? `${(t.ratingAvg ?? 5).toFixed(1)}★ (${t.reviewCount} đánh giá)`
        : "Tour mới";

    return [
      `### ${idx + 1}. ${t.name} (${t.code})`,
      `- **Giá người lớn:** ${formatCurrencyVND(adultPrice)} | **Trẻ em:** ${formatCurrencyVND(childPrice)}`,
      `- **Thời lượng:** ${t.time} | **Khách sạn:** ${stars} | **Phương tiện:** ${t.vehicle || "Theo lịch trình"}`,
      `- **Điểm khởi hành:** ${locs} | **Đánh giá:** ${ratingStr}`,
      tagNames.length > 0 ? `- **Tiện ích:** ${tagNames.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return {
    foundCount: matched.length,
    comparisonText: comparisonLines.join("\n\n"),
    tours: matched.map((t) => {
      const adultPrice = t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
      return {
        code: t.code,
        slug: t.slug,
        name: t.name,
        priceAdultVND: adultPrice,
        priceChildVND:
          (t.priceNewChild ?? 0) > 0
            ? t.priceNewChild!
            : Math.round(adultPrice * 0.7),
        duration: t.time,
        hotelStar: t.hotelStar ?? 4,
        vehicle: t.vehicle || "",
        departures: Array.isArray(t.locations) ? t.locations.map(String) : [],
        ratingAvg: t.ratingAvg ?? 5,
        reviewCount: t.reviewCount ?? 0,
        tags: Array.isArray(t.tags)
          ? t.tags.map((tag) => TOUR_TAG_LABELS[String(tag)] || String(tag))
          : [],
      };
    }),
    matchedContexts: matched,
  };
}

export async function executeGetTourDetails(args: {
  slug?: string;
  code?: string;
  keyword?: string;
}): Promise<{
  found: boolean;
  tour?: {
    id: string;
    code: string;
    slug: string;
    name: string;
    category: string;
    priceAdultVND: number;
    originalPriceAdultVND: number;
    priceChildVND: number;
    priceBabyVND: number;
    stockAdult: number;
    stockChild: number;
    stockBaby: number;
    duration: string;
    vehicle: string;
    departures: string[];
    departureDate: string | null;
    information: string | null;
    schedules: Array<{ day: number; title: string; description: string }>;
    includedStandard: string[];
    excludedStandard: string[];
    ratingAvg: number;
    reviewCount: number;
  };
  tourContext?: AssistantTourContext;
}> {
  const slug = args.slug?.trim();
  const code = args.code?.trim().toUpperCase();
  const keyword = args.keyword?.trim();

  const whereOr: Array<Record<string, unknown>> = [];
  if (slug) whereOr.push({ slug });
  if (code) whereOr.push({ code });
  if (!slug && !code && keyword) {
    whereOr.push({ name: { contains: keyword, mode: "insensitive" } });
    whereOr.push({ code: { contains: keyword, mode: "insensitive" } });
  }

  if (whereOr.length === 0) {
    return { found: false };
  }

  const record = await prisma.tour.findFirst({
    where: {
      deleted: false,
      status: RecordStatus.ACTIVE,
      OR: whereOr,
    },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      avatar: true,
      priceAdult: true,
      priceNewAdult: true,
      priceChild: true,
      priceNewChild: true,
      priceBaby: true,
      priceNewBaby: true,
      stockAdult: true,
      stockChild: true,
      stockBaby: true,
      locations: true,
      time: true,
      vehicle: true,
      departureDate: true,
      information: true,
      schedules: true,
      durationDays: true,
      hotelStar: true,
      singleRoomSurcharge: true,
      tags: true,
      ratingAvg: true,
      reviewCount: true,
      departures: {
        where: { status: RecordStatus.ACTIVE },
        orderBy: [{ departureDate: "asc" }],
      },
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  if (!record) return { found: false };

  const rawSchedules = Array.isArray(record.schedules) ? record.schedules : [];
  const schedules = rawSchedules.map((item, idx) => {
    const obj = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    return {
      day: idx + 1,
      title: String(obj.title || `Ngày ${idx + 1}`),
      description: String(obj.description || ""),
    };
  });

  const serializedDeps: TourDeparturePublic[] = record.departures.map((d) => ({
    ...d,
    departureDate: d.departureDate.toISOString(),
    returnDate: d.returnDate ? d.returnDate.toISOString() : null,
  }));

  const tourContext: AssistantTourContext = {
    id: record.id,
    code: record.code,
    name: record.name,
    slug: record.slug,
    avatar: record.avatar,
    priceAdult: record.priceAdult,
    priceNewAdult: record.priceNewAdult,
    priceNewChild: record.priceNewChild,
    priceNewBaby: record.priceNewBaby,
    stockAdult: record.stockAdult,
    stockChild: record.stockChild,
    stockBaby: record.stockBaby,
    time: record.time,
    vehicle: record.vehicle,
    locations: record.locations,
    departureDate: record.departureDate ? record.departureDate.toISOString() : null,
    ratingAvg: record.ratingAvg,
    reviewCount: record.reviewCount,
    durationDays: record.durationDays,
    hotelStar: record.hotelStar,
    singleRoomSurcharge: record.singleRoomSurcharge,
    tags: record.tags,
    departures: serializedDeps,
    category: record.category,
  };

  return {
    found: true,
    tour: {
      id: record.id,
      code: record.code,
      slug: record.slug,
      name: record.name,
      category: record.category?.name || "",
      priceAdultVND:
        record.priceNewAdult > 0 ? record.priceNewAdult : record.priceAdult,
      originalPriceAdultVND: record.priceAdult,
      priceChildVND:
        record.priceNewChild > 0 ? record.priceNewChild : record.priceChild,
      priceBabyVND:
        record.priceNewBaby > 0 ? record.priceNewBaby : record.priceBaby,
      stockAdult: record.stockAdult,
      stockChild: record.stockChild,
      stockBaby: record.stockBaby,
      duration: record.time,
      vehicle: record.vehicle,
      departures: Array.isArray(record.locations)
        ? record.locations.map((x) => String(x))
        : [],
      departureDate: record.departureDate
        ? record.departureDate.toISOString()
        : null,
      information: record.information,
      schedules,
      includedStandard: [
        "Xe du lịch đời mới / vé máy bay theo chương trình",
        "Khách sạn tiêu chuẩn theo hạng tour",
        "Các bữa ăn chính và vé tham quan theo lịch trình",
        "Hướng dẫn viên suốt tuyến & bảo hiểm du lịch",
      ],
      excludedStandard: [
        "Chi phí cá nhân (giặt ủi, đồ uống ngoài thực đơn, mua sắm)",
        "Phụ thu phòng đơn (nếu ở riêng 1 người)",
        "Vé cáp treo / trò chơi tự túc ngoài mục bao gồm",
        "Tiền tip cho tài xế & HDV (không bắt buộc)",
        "Thuế VAT 8–10% khi xuất hóa đơn GTGT doanh nghiệp",
      ],
      ratingAvg: record.ratingAvg,
      reviewCount: record.reviewCount,
    },
    tourContext,
  };
}

export function executeGetPromotionsAndPolicies(args: {
  topic?: "coupons" | "cancellation" | "payment" | "all";
}) {
  const topic = args.topic || "all";
  return {
    coupons:
      topic === "all" || topic === "coupons"
        ? ACTIVE_COUPONS.filter((c) => c.active)
        : undefined,
    policies:
      topic === "all"
        ? TRAVELVN_POLICIES
        : TRAVELVN_POLICIES.filter((p) => {
            if (topic === "cancellation") return p.id === "cancellation";
            if (topic === "payment") return p.id === "payment" || p.id === "booking";
            return true;
          }),
    supportContact: SUPPORT_CONTACT,
  };
}

export async function executeGetMyOrders(
  args: { orderCode?: string },
  currentUser: ClientUserPublic | null
) {
  if (!currentUser) {
    return {
      authenticated: false,
      message:
        "Bạn chưa đăng nhập. Vui lòng đăng nhập tại /login để xem lịch sử đơn đặt tour cá nhân của bạn.",
    };
  }

  const orderCode = args.orderCode?.trim().toUpperCase();
  const orders = await prisma.order.findMany({
    where: {
      userId: currentUser.id,
      deleted: false,
      ...(orderCode ? { code: orderCode } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      code: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      subTotal: true,
      discount: true,
      couponCode: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          name: true,
          departureDate: true,
          departureLocation: true,
          quantityAdult: true,
          quantityChild: true,
          quantityBaby: true,
        },
      },
    },
  });

  return {
    authenticated: true,
    userName: currentUser.fullName,
    orders: orders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((it) => ({
        ...it,
        departureDate: it.departureDate ? it.departureDate.toISOString() : null,
      })),
    })),
  };
}

export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: "search_tours",
    description:
      "Tìm kiếm và lọc danh sách tour đang mở bán từ cơ sở dữ liệu thật theo từ khóa điểm đến, chủ đề (biển/núi/nước ngoài/trong nước), ngân sách tối đa/người, điểm khởi hành hoặc tour giảm giá.",
    parameters: {
      type: "OBJECT",
      properties: {
        keyword: {
          type: "STRING",
          description:
            "Từ khóa địa điểm, tên tour hoặc mã tour (vd: Phú Quốc, Nhật Bản, SaPa, Đà Nẵng).",
        },
        themeTag: {
          type: "STRING",
          enum: [
            "bien",
            "nui",
            "nuoc-ngoai",
            "trong-nuoc",
            "mien-bac",
            "mien-trung",
            "mien-nam",
            "tat-ca",
          ],
          description:
            "Phân loại chủ đề/khu vực: 'bien' cho tour biển đảo, 'nui' cho tour núi cao nguyên, 'nuoc-ngoai' cho tour quốc tế, 'trong-nuoc' cho tour nội địa, 'mien-bac'/'mien-trung'/'mien-nam' theo vùng miền.",
        },
        maxPriceVND: {
          type: "NUMBER",
          description:
            "Ngân sách tối đa mỗi khách tính bằng VNĐ (vd: dưới 5 triệu -> 5000000).",
        },
        minPriceVND: {
          type: "NUMBER",
          description: "Ngân sách tối thiểu tính bằng VNĐ.",
        },
        departureLocation: {
          type: "STRING",
          description: "Nơi khởi hành (vd: Hà Nội, Hồ Chí Minh, Đà Nẵng).",
        },
        dealOnly: {
          type: "BOOLEAN",
          description: "True nếu chỉ tìm tour đang giảm giá.",
        },
        sortBy: {
          type: "STRING",
          enum: ["price-asc", "price-desc", "rating-desc", "discount-desc"],
        },
        limit: {
          type: "NUMBER",
          description: "Số lượng tour tối đa trả về (1-8).",
        },
      },
    },
  },
  {
    name: "find_departures_with_quote",
    description:
      "Tìm đợt khởi hành còn chỗ và TÍNH BÁO GIÁ TRỌN NHÓM chính xác cho số lượng Người lớn, Trẻ em, Em bé và Phòng đơn (kèm lọc theo tổng ngân sách nhóm, điểm đi, tháng khởi hành YYYY-MM). Luôn gọi tool này khi khách hỏi cho gia đình/nhóm người hoặc hỏi tổng chi phí đoàn.",
    parameters: {
      type: "OBJECT",
      properties: {
        keyword: {
          type: "STRING",
          description: "Từ khóa địa điểm hoặc tên tour.",
        },
        themeTag: {
          type: "STRING",
          enum: [
            "bien",
            "nui",
            "nuoc-ngoai",
            "trong-nuoc",
            "mien-bac",
            "mien-trung",
            "mien-nam",
            "tat-ca",
          ],
        },
        adults: {
          type: "NUMBER",
          description: "Số lượng người lớn (mặc định 1).",
        },
        children: {
          type: "NUMBER",
          description: "Số lượng trẻ em (5-11 tuổi, mặc định 0).",
        },
        babies: {
          type: "NUMBER",
          description: "Số lượng em bé (<5 tuổi, mặc định 0).",
        },
        singleRooms: {
          type: "NUMBER",
          description: "Số lượng phòng đơn phụ thu (mặc định 0).",
        },
        maxTotalBudgetVND: {
          type: "NUMBER",
          description: "Tổng ngân sách tối đa cho cả nhóm tính bằng VNĐ.",
        },
        departureLocation: {
          type: "STRING",
          description: "Điểm khởi hành (vd: Hà Nội, Hồ Chí Minh, Đà Nẵng).",
        },
        departureMonth: {
          type: "STRING",
          description: "Tháng khởi hành dạng YYYY-MM (vd: 2026-06).",
        },
        limit: {
          type: "NUMBER",
          description: "Số lượng phương án tối đa (1-6).",
        },
      },
    },
  },
  {
    name: "compare_tours",
    description:
      "So sánh song song 2 đến 4 tour theo mã tour hoặc slug (giá người lớn/trẻ em, thời lượng, hạng khách sạn, phương tiện, điểm khởi hành, đánh giá, tiện ích).",
    parameters: {
      type: "OBJECT",
      properties: {
        tourCodesOrSlugs: {
          type: "ARRAY",
          items: { type: "STRING" },
          description:
            "Danh sách 2-4 mã tour, slug hoặc tên tour cần so sánh.",
        },
      },
      required: ["tourCodesOrSlugs"],
    },
  },
  {
    name: "get_tour_details",
    description:
      "Lấy thông tin chi tiết đầy đủ của 1 tour cụ thể bao gồm lịch trình từng ngày (Ngày 1, Ngày 2, Ngày 3...), giá người lớn/trẻ em/em bé, số chỗ còn lại, ngày khởi hành. Luôn gọi hàm này khi người dùng hỏi chi tiết hoặc lịch trình của tour đang xem hay một mã/tên tour cụ thể.",
    parameters: {
      type: "OBJECT",
      properties: {
        slug: {
          type: "STRING",
          description: "Slug của tour (vd: kham-pha-nhat-ban-tokyo-phu-si-kyoto).",
        },
        code: {
          type: "STRING",
          description: "Mã tour (vd: TOUR00005).",
        },
        keyword: {
          type: "STRING",
          description: "Tên tour hoặc từ khóa nhận diện nếu không có slug/code.",
        },
      },
    },
  },
  {
    name: "get_promotions_and_policies",
    description:
      "Lấy danh sách mã giảm giá đang hoạt động (như TOUR2026, GIAM10...), chính sách hoàn/hủy/đổi lịch khởi hành, phương thức thanh toán và thông tin liên hệ hỗ trợ chính thức của VN.TRAVEL.",
    parameters: {
      type: "OBJECT",
      properties: {
        topic: {
          type: "STRING",
          enum: ["coupons", "cancellation", "payment", "all"],
          description: "Chủ đề cần tra cứu.",
        },
      },
    },
  },
  {
    name: "get_my_orders",
    description:
      "Tra cứu đơn đặt tour của chính khách hàng đang đăng nhập hiện tại. Tuyệt đối không dùng để tra cứu đơn của người khác.",
    parameters: {
      type: "OBJECT",
      properties: {
        orderCode: {
          type: "STRING",
          description: "Mã đơn hàng cụ thể nếu khách cung cấp (không bắt buộc).",
        },
      },
    },
  },
];
