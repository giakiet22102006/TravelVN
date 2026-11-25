"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  type ClientCategoryFlatItem,
  useClientMeta,
} from "@/components/client/ClientLayoutShell";
import { TourCard, type TourCardData } from "@/components/client/TourCard";
import { DatePickerInput } from "@/components/client/DatePickerInput";
import { SmartImage } from "@/components/client/SmartImage";
import { formatCurrencyVND } from "@/lib/format";
import { TOUR_TAG_LABELS } from "@/types/ota";

export interface InitialToursResult {
  tours: TourCardData[];
  total: number;
  page: number;
  totalPages: number;
  categoryInfo: ClientCategoryFlatItem | null;
}

const DEPARTURE_LOCATIONS = [
  "Hà Nội",
  "Đà Nẵng",
  "Hồ Chí Minh",
  "Nha Trang",
];

const SLIDER_MIN = 0;
const SLIDER_MAX = 70_000_000;
const SLIDER_STEP = 500_000;

const PRICE_PRESETS = [
  { label: "< 3tr", min: 0, max: 3_000_000 },
  { label: "3–7tr", min: 3_000_000, max: 7_000_000 },
  { label: "7–15tr", min: 7_000_000, max: 15_000_000 },
  { label: "15–30tr", min: 15_000_000, max: 30_000_000 },
  { label: "> 30tr", min: 30_000_000, max: SLIDER_MAX },
];

const DURATION_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "1-3", label: "1–3 ngày" },
  { value: "4-5", label: "4–5 ngày" },
  { value: "6+", label: "6+ ngày" },
];

const VEHICLE_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "Máy bay", label: "Máy bay" },
  { value: "Ô tô", label: "Ô tô" },
  { value: "Du thuyền", label: "Du thuyền" },
];

const HOTEL_STAR_OPTIONS = [
  { value: 0, label: "Tất cả" },
  { value: 3, label: "Từ 3★" },
  { value: 4, label: "Từ 4★" },
  { value: 5, label: "5★" },
];

const FACET_TAGS = ["NO_SHOP", "BAY_THANG", "GIA_DINH", "NGHI_DUONG"] as const;

const LEGACY_PRICE_LABELS: Record<string, string> = {
  "under-2m": "Dưới 2 triệu",
  lt2: "Dưới 2 triệu",
  "2m-4m": "Từ 2 - 4 triệu",
  "2to4": "Từ 2 - 4 triệu",
  "4m-8m": "Từ 4 - 8 triệu",
  "4to8": "Từ 4 - 8 triệu",
  "over-8m": "Trên 8 triệu",
  gt8: "Trên 8 triệu",
};

const SORT_TABS = [
  { key: "", label: "Xem tất cả" },
  { key: "deal", label: "Khuyến Mại Hot" },
  { key: "price-asc", label: "Giá tăng dần" },
  { key: "price-desc", label: "Giá giảm dần" },
  { key: "rating-desc", label: "Đánh giá cao" },
  { key: "departure-asc", label: "Khởi hành gần nhất" },
];

function getUpcomingMonths(count = 6): Array<{ value: string; label: string }> {
  const vnFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  });
  const [yrStr, moStr] = vnFmt.format(new Date()).split("-");
  const baseYear = Number(yrStr) || 2026;
  const baseMonth = (Number(moStr) || 1) - 1;

  const result: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const totalMonths = baseYear * 12 + baseMonth + i;
    const y = Math.floor(totalMonths / 12);
    const m = (totalMonths % 12) + 1;
    const mm = String(m).padStart(2, "0");
    result.push({
      value: `${y}-${mm}`,
      label: `Tháng ${mm}/${y}`,
    });
  }
  return result;
}

function clampPrice(val: number, fallback: number): number {
  if (!Number.isFinite(val) || val < SLIDER_MIN) return fallback;
  return Math.min(SLIDER_MAX, Math.round(val / SLIDER_STEP) * SLIDER_STEP);
}

export function ToursCatalogClient({
  initialResult,
  initialQueryKey,
}: {
  initialResult: InitialToursResult;
  initialQueryKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories } = useClientMeta();

  const upcomingMonths = useMemo(() => getUpcomingMonths(6), []);

  // Read live URL parameters
  const urlCategory = searchParams.get("category") || "";
  const urlDestination =
    searchParams.get("destination") || searchParams.get("keyword") || "";
  const urlDepartureLocation = searchParams.get("departureLocation") || "";
  const urlDepartureDate = searchParams.get("departureDate") || "";
  const urlDepartureMonth = searchParams.get("departureMonth") || "";
  const urlAdult = Number(searchParams.get("adult") || 0) || 0;
  const urlChild = Number(searchParams.get("child") || 0) || 0;
  const urlBaby = Number(searchParams.get("baby") || 0) || 0;
  const urlPriceRange = searchParams.get("priceRange") || "";
  const urlMinPriceRaw = Number(searchParams.get("minPrice") || 0);
  const urlMaxPriceRaw = Number(searchParams.get("maxPrice") || 0);
  const urlMinPrice =
    urlMinPriceRaw > 0 ? clampPrice(urlMinPriceRaw, SLIDER_MIN) : SLIDER_MIN;
  const urlMaxPrice =
    urlMaxPriceRaw > 0 ? clampPrice(urlMaxPriceRaw, SLIDER_MAX) : SLIDER_MAX;
  const urlDurationBucket = searchParams.get("durationBucket") || "";
  const urlVehicle = searchParams.get("vehicle") || "";
  const urlHotelStar = Number(searchParams.get("hotelStar") || 0) || 0;
  const urlTagsRaw = searchParams.get("tags") || "";
  const urlTags = useMemo(
    () =>
      urlTagsRaw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    [urlTagsRaw]
  );
  const urlDealRaw = (searchParams.get("deal") || "").toLowerCase();
  const urlDeal = urlDealRaw === "true" || urlDealRaw === "1";
  const urlSort = searchParams.get("sort") || "";
  const urlPage = Math.max(1, Number(searchParams.get("page") || 1) || 1);

  // Local filter form draft state synced to URL
  const [category, setCategory] = useState(urlCategory);
  const [destination, setDestination] = useState(urlDestination);
  const [departureLocation, setDepartureLocation] = useState(
    urlDepartureLocation
  );
  const [departureDate, setDepartureDate] = useState(urlDepartureDate);
  const [departureMonth, setDepartureMonth] = useState(urlDepartureMonth);
  const [adult, setAdult] = useState(urlAdult);
  const [child, setChild] = useState(urlChild);
  const [baby, setBaby] = useState(urlBaby);
  const [minPrice, setMinPrice] = useState(urlMinPrice);
  const [maxPrice, setMaxPrice] = useState(
    Math.max(urlMinPrice, urlMaxPrice)
  );
  const [durationBucket, setDurationBucket] = useState(urlDurationBucket);
  const [vehicle, setVehicle] = useState(urlVehicle);
  const [hotelStar, setHotelStar] = useState(urlHotelStar);
  const [selectedTags, setSelectedTags] = useState<string[]>(urlTags);
  const [dealOnly, setDealOnly] = useState(urlDeal);

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileFilterOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileFilterOpen]);

  // API state initialized from SSR (prevents "0 Tour" flash & extra initial request)
  const [categoryInfo, setCategoryInfo] = useState<ClientCategoryFlatItem | null>(
    initialResult.categoryInfo
  );
  const [tours, setTours] = useState<TourCardData[]>(initialResult.tours);
  const [total, setTotal] = useState(initialResult.total);
  const [effectivePage, setEffectivePage] = useState(
    Math.max(1, initialResult.page)
  );
  const [totalPages, setTotalPages] = useState(
    Math.max(1, initialResult.totalPages)
  );
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const lastFetchedKeyRef = useRef(initialQueryKey);

  useEffect(() => {
    setCategory(urlCategory);
    setDestination(urlDestination);
    setDepartureLocation(urlDepartureLocation);
    setDepartureDate(urlDepartureDate);
    setDepartureMonth(urlDepartureMonth);
    setAdult(urlAdult);
    setChild(urlChild);
    setBaby(urlBaby);
    setMinPrice(urlMinPrice);
    setMaxPrice(Math.max(urlMinPrice, urlMaxPrice));
    setDurationBucket(urlDurationBucket);
    setVehicle(urlVehicle);
    setHotelStar(urlHotelStar);
    setSelectedTags(urlTags);
    setDealOnly(urlDeal);
  }, [
    urlCategory,
    urlDestination,
    urlDepartureLocation,
    urlDepartureDate,
    urlDepartureMonth,
    urlAdult,
    urlChild,
    urlBaby,
    urlMinPrice,
    urlMaxPrice,
    urlDurationBucket,
    urlVehicle,
    urlHotelStar,
    urlTags,
    urlDeal,
  ]);

  // Load filtered tours when URL query changes after initial SSR render
  useEffect(() => {
    const apiParams = new URLSearchParams();
    if (urlCategory) apiParams.set("category", urlCategory);
    if (urlDestination) apiParams.set("destination", urlDestination);
    if (urlDepartureLocation) {
      apiParams.set("departureLocation", urlDepartureLocation);
    }
    if (urlDepartureDate) apiParams.set("departureDate", urlDepartureDate);
    if (urlDepartureMonth) apiParams.set("departureMonth", urlDepartureMonth);
    if (urlAdult > 0) apiParams.set("adult", String(urlAdult));
    if (urlChild > 0) apiParams.set("child", String(urlChild));
    if (urlBaby > 0) apiParams.set("baby", String(urlBaby));
    if (urlPriceRange) apiParams.set("priceRange", urlPriceRange);
    if (urlMinPrice > SLIDER_MIN) apiParams.set("minPrice", String(urlMinPrice));
    if (urlMaxPrice < SLIDER_MAX) apiParams.set("maxPrice", String(urlMaxPrice));
    if (urlDurationBucket) apiParams.set("durationBucket", urlDurationBucket);
    if (urlVehicle) apiParams.set("vehicle", urlVehicle);
    if (urlHotelStar > 0) apiParams.set("hotelStar", String(urlHotelStar));
    if (urlTags.length > 0) apiParams.set("tags", urlTags.join(","));
    if (urlDeal) apiParams.set("deal", "true");
    if (urlSort) apiParams.set("sort", urlSort);
    apiParams.set("page", String(urlPage));
    apiParams.set("limit", "9");

    const nextKey = apiParams.toString();
    if (nextKey === lastFetchedKeyRef.current && retryNonce === 0) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/client/tours?${nextKey}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch tours");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        lastFetchedKeyRef.current = nextKey;
        setTours(Array.isArray(data.tours) ? data.tours : []);
        setTotal(Number(data.total || 0));
        setEffectivePage(Math.max(1, Number(data.page || 1)));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        setCategoryInfo(data.categoryInfo ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(
            "Không thể tải danh sách tour lúc này. Vui lòng kiểm tra kết nối mạng và thử lại."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    urlCategory,
    urlDestination,
    urlDepartureLocation,
    urlDepartureDate,
    urlDepartureMonth,
    urlAdult,
    urlChild,
    urlBaby,
    urlPriceRange,
    urlMinPrice,
    urlMaxPrice,
    urlDurationBucket,
    urlVehicle,
    urlHotelStar,
    urlTags,
    urlDeal,
    urlSort,
    urlPage,
    retryNonce,
  ]);

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | boolean | null>) => {
      const next = new URLSearchParams();
      const base: Record<string, string | number | boolean | null> = {
        category,
        destination,
        departureLocation,
        departureDate,
        departureMonth,
        adult: adult > 0 ? adult : null,
        child: child > 0 ? child : null,
        baby: baby > 0 ? baby : null,
        minPrice: minPrice > SLIDER_MIN ? minPrice : null,
        maxPrice: maxPrice < SLIDER_MAX ? maxPrice : null,
        durationBucket,
        vehicle,
        hotelStar: hotelStar > 0 ? hotelStar : null,
        tags: selectedTags.length > 0 ? selectedTags.join(",") : null,
        deal: dealOnly ? "true" : null,
        sort: urlSort,
        page: 1,
        ...overrides,
      };

      for (const [k, v] of Object.entries(base)) {
        if (v !== null && v !== "" && v !== false && v !== 0) {
          next.set(k, String(v));
        }
      }

      const qs = next.toString();
      router.push(`/tours${qs ? `?${qs}` : ""}`);
    },
    [
      router,
      category,
      destination,
      departureLocation,
      departureDate,
      departureMonth,
      adult,
      child,
      baby,
      minPrice,
      maxPrice,
      durationBucket,
      vehicle,
      hotelStar,
      selectedTags,
      dealOnly,
      urlSort,
    ]
  );

  function handleApplyFilter(e: React.FormEvent) {
    e.preventDefault();
    setMobileFilterOpen(false);
    navigateWithParams({ priceRange: null, page: 1 });
  }

  function handleResetFilter() {
    setCategory("");
    setDestination("");
    setDepartureLocation("");
    setDepartureDate("");
    setDepartureMonth("");
    setAdult(0);
    setChild(0);
    setBaby(0);
    setMinPrice(SLIDER_MIN);
    setMaxPrice(SLIDER_MAX);
    setDurationBucket("");
    setVehicle("");
    setHotelStar(0);
    setSelectedTags([]);
    setDealOnly(false);
    setMobileFilterOpen(false);
    router.push("/tours");
  }

  function toggleTag(tagCode: string) {
    setSelectedTags((prev) =>
      prev.includes(tagCode)
        ? prev.filter((t) => t !== tagCode)
        : [...prev, tagCode]
    );
  }

  // Removable Active Filter Chips derived from live URL state
  const activeFilterChips = useMemo(() => {
    const chips: Array<{
      id: string;
      label: string;
      onRemove: () => void;
    }> = [];

    if (urlCategory) {
      const catName =
        categories.find((c) => c.slug === urlCategory)?.name || urlCategory;
      chips.push({
        id: "category",
        label: `Danh mục: ${catName}`,
        onRemove: () => navigateWithParams({ category: null, page: 1 }),
      });
    }
    if (urlDestination) {
      chips.push({
        id: "destination",
        label: `Điểm đến: ${urlDestination}`,
        onRemove: () => navigateWithParams({ destination: null, page: 1 }),
      });
    }
    if (urlDepartureLocation) {
      chips.push({
        id: "departureLocation",
        label: `Khởi hành: ${urlDepartureLocation}`,
        onRemove: () =>
          navigateWithParams({ departureLocation: null, page: 1 }),
      });
    }
    if (urlDepartureDate) {
      chips.push({
        id: "departureDate",
        label: `Ngày đi: ${urlDepartureDate}`,
        onRemove: () => navigateWithParams({ departureDate: null, page: 1 }),
      });
    }
    if (urlDepartureMonth) {
      const [y, m] = urlDepartureMonth.split("-");
      chips.push({
        id: "departureMonth",
        label: y && m ? `Tháng ${m}/${y}` : urlDepartureMonth,
        onRemove: () => navigateWithParams({ departureMonth: null, page: 1 }),
      });
    }
    if (urlAdult > 0 || urlChild > 0 || urlBaby > 0) {
      const parts = [
        urlAdult > 0 ? `${urlAdult} NL` : "",
        urlChild > 0 ? `${urlChild} TE` : "",
        urlBaby > 0 ? `${urlBaby} EB` : "",
      ].filter(Boolean);
      chips.push({
        id: "passengers",
        label: `Khách: ${parts.join(", ")}`,
        onRemove: () =>
          navigateWithParams({ adult: null, child: null, baby: null, page: 1 }),
      });
    }
    if (urlMinPrice > SLIDER_MIN || urlMaxPrice < SLIDER_MAX) {
      chips.push({
        id: "price",
        label: `Giá: ${formatCurrencyVND(urlMinPrice)} – ${formatCurrencyVND(
          urlMaxPrice
        )}`,
        onRemove: () =>
          navigateWithParams({ minPrice: null, maxPrice: null, page: 1 }),
      });
    } else if (urlPriceRange) {
      chips.push({
        id: "priceRange",
        label: `Mức giá: ${LEGACY_PRICE_LABELS[urlPriceRange] || urlPriceRange}`,
        onRemove: () => navigateWithParams({ priceRange: null, page: 1 }),
      });
    }
    if (urlDurationBucket) {
      const durLabel =
        DURATION_OPTIONS.find((d) => d.value === urlDurationBucket)?.label ||
        urlDurationBucket;
      chips.push({
        id: "durationBucket",
        label: `Thời lượng: ${durLabel}`,
        onRemove: () => navigateWithParams({ durationBucket: null, page: 1 }),
      });
    }
    if (urlVehicle) {
      chips.push({
        id: "vehicle",
        label: `Phương tiện: ${urlVehicle}`,
        onRemove: () => navigateWithParams({ vehicle: null, page: 1 }),
      });
    }
    if (urlHotelStar > 0) {
      chips.push({
        id: "hotelStar",
        label:
          urlHotelStar === 5 ? "Khách sạn 5★" : `Khách sạn từ ${urlHotelStar}★`,
        onRemove: () => navigateWithParams({ hotelStar: null, page: 1 }),
      });
    }
    for (const tag of urlTags) {
      chips.push({
        id: `tag-${tag}`,
        label: TOUR_TAG_LABELS[tag] || tag,
        onRemove: () => {
          const nextTags = urlTags.filter((t) => t !== tag);
          navigateWithParams({
            tags: nextTags.length > 0 ? nextTags.join(",") : null,
            page: 1,
          });
        },
      });
    }
    if (urlDeal) {
      chips.push({
        id: "deal",
        label: "Đang giảm giá",
        onRemove: () =>
          navigateWithParams({
            deal: null,
            sort: urlSort === "deal" ? null : urlSort || null,
            page: 1,
          }),
      });
    }

    return chips;
  }, [
    categories,
    navigateWithParams,
    urlAdult,
    urlBaby,
    urlCategory,
    urlChild,
    urlDeal,
    urlDepartureDate,
    urlDepartureLocation,
    urlDepartureMonth,
    urlDestination,
    urlDurationBucket,
    urlHotelStar,
    urlMaxPrice,
    urlMinPrice,
    urlPriceRange,
    urlSort,
    urlTags,
    urlVehicle,
  ]);

  const pageTitle =
    categoryInfo?.name ||
    (urlDeal ? "Tour Ưu Đãi Giờ Chót" : "Tất Cả Tour Du Lịch");
  const pageDescription =
    categoryInfo?.description ||
    "Khám phá hàng loạt hành trình đặc sắc trong nước và quốc tế cùng VN.TRAVEL với lịch khởi hành liên tục, dịch vụ trọn gói 5 sao và ưu đãi hấp dẫn.";
  const bannerImage =
    categoryInfo?.avatar ||
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80";

  const minPercent = ((minPrice - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  const maxPercent = ((maxPrice - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

  const renderFilterFields = (idPrefix: string) => (
    <div className="space-y-4 text-[13px]">
      <div>
        <label
          htmlFor={`${idPrefix}-category`}
          className="block font-semibold text-ink mb-1.5"
        >
          Danh mục tour
        </label>
        <select
          id={`${idPrefix}-category`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-border-strong bg-white text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
        >
          <option value="">-- Tất cả danh mục --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {(c.depth ?? 0) > 0 ? `— ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-departure-location`}
          className="block font-semibold text-ink mb-1.5"
        >
          Điểm đi
        </label>
        <select
          id={`${idPrefix}-departure-location`}
          value={departureLocation}
          onChange={(e) => setDepartureLocation(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-border-strong bg-white text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
        >
          <option value="">-- Chọn điểm đi --</option>
          {DEPARTURE_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-destination`}
          className="block font-semibold text-ink mb-1.5"
        >
          Điểm đến
        </label>
        <input
          id={`${idPrefix}-destination`}
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="-- Nhập điểm đến --"
          className="w-full h-[40px] px-3 rounded-[8px] border border-border-strong bg-white text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-departure-month`}
          className="block font-semibold text-ink mb-1.5"
        >
          Tháng khởi hành
        </label>
        <select
          id={`${idPrefix}-departure-month`}
          value={departureMonth}
          onChange={(e) => setDepartureMonth(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-border-strong bg-white text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
        >
          <option value="">-- Tất cả các tháng --</option>
          {upcomingMonths.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-departure-date`}
          className="block font-semibold text-ink mb-1.5"
        >
          Từ ngày khởi hành
        </label>
        <DatePickerInput
          variant="compact"
          inputId={`${idPrefix}-departure-date`}
          value={departureDate}
          onChange={setDepartureDate}
        />
      </div>

      {/* Dual-Range Price Slider */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="font-semibold text-ink">Khoảng giá / người</span>
        </div>
        <div className="bg-surface-page border border-border-subtle rounded-[10px] p-3">
          <div className="flex items-center justify-between text-[12px] font-bold text-client-primary tabular-nums mb-2.5">
            <span>{formatCurrencyVND(minPrice)}</span>
            <span>{formatCurrencyVND(maxPrice)}</span>
          </div>

          <div className="relative h-6 flex items-center">
            <div className="w-full h-1.5 rounded-full bg-border-subtle" />
            <div
              className="absolute h-1.5 rounded-full bg-client-primary"
              style={{
                left: `${minPercent}%`,
                width: `${Math.max(0, maxPercent - minPercent)}%`,
              }}
            />
            <input
              type="range"
              aria-label="Giá tối thiểu"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={SLIDER_STEP}
              value={minPrice}
              onChange={(e) => {
                const nextMin = Math.min(
                  Number(e.target.value),
                  maxPrice - SLIDER_STEP
                );
                setMinPrice(Math.max(SLIDER_MIN, nextMin));
              }}
              className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-client-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-client-primary [&::-moz-range-thumb]:cursor-pointer"
            />
            <input
              type="range"
              aria-label="Giá tối đa"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={SLIDER_STEP}
              value={maxPrice}
              onChange={(e) => {
                const nextMax = Math.max(
                  Number(e.target.value),
                  minPrice + SLIDER_STEP
                );
                setMaxPrice(Math.min(SLIDER_MAX, nextMax));
              }}
              className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-client-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-client-primary [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((preset) => {
              const active =
                minPrice === preset.min && maxPrice === preset.max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setMinPrice(preset.min);
                    setMaxPrice(preset.max);
                  }}
                  className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold border transition-colors ${
                    active
                      ? "bg-client-primary border-client-primary text-white"
                      : "bg-white border-border-subtle text-ink hover:border-client-primary hover:text-client-primary"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Thời lượng */}
      <div>
        <span className="block font-semibold text-ink mb-1.5">Thời lượng</span>
        <div className="grid grid-cols-2 gap-1.5">
          {DURATION_OPTIONS.map((opt) => {
            const active = durationBucket === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDurationBucket(opt.value)}
                className={`h-[34px] px-2 rounded-[7px] text-[12px] font-medium border transition-colors ${
                  active
                    ? "bg-client-primary border-client-primary text-white"
                    : "bg-white border-border-subtle text-ink hover:border-client-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Phương tiện */}
      <div>
        <span className="block font-semibold text-ink mb-1.5">Phương tiện</span>
        <div className="grid grid-cols-2 gap-1.5">
          {VEHICLE_OPTIONS.map((opt) => {
            const active = vehicle === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setVehicle(opt.value)}
                className={`h-[34px] px-2 rounded-[7px] text-[12px] font-medium border transition-colors ${
                  active
                    ? "bg-client-primary border-client-primary text-white"
                    : "bg-white border-border-subtle text-ink hover:border-client-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tiêu chuẩn khách sạn */}
      <div>
        <span className="block font-semibold text-ink mb-1.5">
          Tiêu chuẩn khách sạn
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {HOTEL_STAR_OPTIONS.map((opt) => {
            const active = hotelStar === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setHotelStar(opt.value)}
                className={`h-[34px] px-2 rounded-[7px] text-[12px] font-medium border transition-colors ${
                  active
                    ? "bg-client-primary border-client-primary text-white"
                    : "bg-white border-border-subtle text-ink hover:border-client-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tiện ích & Cam kết */}
      <div>
        <span className="block font-semibold text-ink mb-1.5">
          Tiện ích &amp; Cam kết
        </span>
        <div className="flex flex-wrap gap-1.5">
          {FACET_TAGS.map((tagCode) => {
            const active = selectedTags.includes(tagCode);
            return (
              <button
                key={tagCode}
                type="button"
                onClick={() => toggleTag(tagCode)}
                className={`px-2.5 py-1.5 rounded-[7px] text-[12px] font-medium border transition-colors ${
                  active
                    ? "bg-client-soft border-client-primary text-client-primary font-semibold"
                    : "bg-white border-border-subtle text-ink hover:border-client-primary"
                }`}
              >
                {TOUR_TAG_LABELS[tagCode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Số lượng hành khách */}
      <div>
        <label className="block font-semibold text-ink mb-2">
          Số Lượng Hành Khách
        </label>
        <div className="space-y-2.5 bg-surface-page p-3 rounded-[8px] border border-border-subtle">
          {[
            { label: "Người lớn:", value: adult, setter: setAdult },
            { label: "Trẻ em:", value: child, setter: setChild },
            { label: "Em bé:", value: baby, setter: setBaby },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-ink-muted font-medium">{row.label}</span>
              <input
                type="number"
                min={0}
                aria-label={row.label}
                value={row.value}
                onChange={(e) =>
                  row.setter(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-[74px] h-[34px] px-2 rounded-[6px] border border-border-strong bg-white text-center font-semibold text-ink tabular-nums focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
              />
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
        <input
          type="checkbox"
          checked={dealOnly}
          onChange={(e) => setDealOnly(e.target.checked)}
          className="w-4 h-4 accent-client-primary rounded"
        />
        <span className="font-semibold text-ink">
          Chỉ xem tour đang giảm giá
        </span>
      </label>
    </div>
  );

  const renderFilterActions = (formId?: string) => (
    <div className="space-y-2">
      <button
        type="submit"
        form={formId}
        className="w-full h-[42px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[14px] transition-colors"
      >
        Áp Dụng
      </button>
      <button
        type="button"
        onClick={handleResetFilter}
        className="w-full h-[38px] rounded-[8px] border border-border-strong hover:border-client-primary text-ink-muted hover:text-client-primary font-medium text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Đặt lại bộ lọc</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Category Banner */}
      <section className="relative h-[200px] sm:h-[250px] bg-client-deep text-white overflow-hidden">
        <SmartImage
          src={bannerImage}
          alt={pageTitle}
          targetWidth={2000}
          quality={90}
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/25" />
        <div className="absolute inset-0 max-w-[1184px] mx-auto px-4 flex flex-col justify-end pb-7">
          <nav className="text-[12px] sm:text-[13px] text-white/85 flex items-center gap-2 mb-2">
            <Link
              href="/"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              Trang chủ
            </Link>
            <span>&gt;</span>
            <span className="font-medium text-white">{pageTitle}</span>
          </nav>
          <h1 className="text-[24px] sm:text-[34px] font-bold leading-tight">
            {pageTitle}
          </h1>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-[1184px] mx-auto px-4 py-8">
        {/* Category Description */}
        <div className="bg-white rounded-[12px] border border-border-subtle p-4 sm:p-5 mb-7 text-[14px] text-ink-muted leading-relaxed shadow-[0_2px_10px_rgba(22,34,41,0.05)]">
          {pageDescription}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Left Filter Sidebar */}
          {isDesktop && (
            <aside className="hidden lg:block lg:col-span-3 bg-white rounded-[12px] border border-border-subtle p-5 shadow-[0_2px_10px_rgba(22,34,41,0.05)] sticky top-[125px]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
                <h2 className="text-[18px] font-bold text-ink inline-flex items-center gap-2">
                  <span>Bộ Lọc</span>
                </h2>
                <Filter className="w-4 h-4 text-client-primary" />
              </div>
              <form onSubmit={handleApplyFilter} className="space-y-4">
                {renderFilterFields("desktop-filter")}
                <div className="pt-2">{renderFilterActions()}</div>
              </form>
            </aside>
          )}

          {/* Right Tour List */}
          <div className="lg:col-span-9">
            {/* Sort & Count Bar */}
            <div className="bg-white rounded-[12px] border border-border-subtle p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-[0_2px_10px_rgba(22,34,41,0.05)]">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold text-ink-muted mr-1 whitespace-nowrap">
                  Sắp xếp :
                </span>
                {SORT_TABS.map((tab) => {
                  const active =
                    tab.key === "deal"
                      ? urlSort === "deal"
                      : tab.key === ""
                      ? !urlSort
                      : urlSort === tab.key;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => {
                        if (tab.key === "deal") {
                          navigateWithParams({
                            sort: "deal",
                            deal: "true",
                            page: 1,
                          });
                        } else if (tab.key === "") {
                          navigateWithParams({
                            sort: null,
                            deal: null,
                            page: 1,
                          });
                        } else {
                          navigateWithParams({
                            sort: tab.key,
                            deal: urlDeal ? "true" : null,
                            page: 1,
                          });
                        }
                      }}
                      className={`px-3 py-1.5 min-h-[36px] rounded-[8px] font-medium whitespace-nowrap transition-colors ${
                        active
                          ? "bg-client-primary text-white"
                          : "bg-surface-muted text-ink hover:bg-client-soft hover:text-client-primary"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(true)}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                  <span>Bộ Lọc</span>
                </button>

                <span className="text-[14px] text-ink-muted whitespace-nowrap shrink-0 tabular-nums">
                  Tất cả:{" "}
                  <strong className="text-ink font-bold tabular-nums">
                    {loading && tours.length === 0 ? "..." : `${total} Tour`}
                  </strong>
                </span>
              </div>
            </div>

            {/* Removable Active Filter Chips */}
            {activeFilterChips.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {activeFilterChips.map((chip) => (
                  <span
                    key={chip.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-client-soft border border-client-border text-[12px] font-semibold text-client-primary"
                  >
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      aria-label={`Bỏ lọc ${chip.label}`}
                      onClick={chip.onRemove}
                      className="w-4 h-4 rounded-full hover:bg-client-primary hover:text-white inline-flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {activeFilterChips.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="text-[12px] font-semibold text-client-accent hover:text-client-accent-hover hover:underline px-1.5 py-1 transition-colors"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>
            )}

            {total > 0 && urlPage > totalPages && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-status-warn-bg border border-status-warn-border px-4 py-2.5 text-[13px] text-status-warn tabular-nums">
                <span>
                  Trang <strong>{urlPage}</strong> vượt quá tổng số{" "}
                  <strong>{totalPages}</strong> trang hiện có — đang hiển thị
                  trang {effectivePage}.
                </span>
                <button
                  type="button"
                  onClick={() => navigateWithParams({ page: 1 })}
                  className="font-bold text-client-primary hover:underline whitespace-nowrap"
                >
                  Về trang 1
                </button>
              </div>
            )}

            {/* Slim Zero-Flicker Loading Bar when updating existing results */}
            {loading && tours.length > 0 && (
              <div
                aria-label="Đang cập nhật danh sách tour"
                className="mb-3 h-0.5 w-full rounded-full bg-client-soft overflow-hidden"
              >
                <div className="h-full w-1/2 bg-client-primary animate-pulse rounded-full" />
              </div>
            )}

            {/* Tour Grid */}
            {loading && tours.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="rounded-[12px] bg-white border border-border-subtle overflow-hidden animate-pulse flex flex-col"
                  >
                    <div className="aspect-[16/10] w-full bg-surface-muted" />
                    <div className="p-4 space-y-3 flex-1">
                      <div className="h-4 bg-surface-muted rounded w-5/6" />
                      <div className="h-4 bg-surface-muted rounded w-2/3" />
                      <div className="h-5 bg-surface-muted rounded w-1/2 mt-1" />
                      <div className="space-y-1.5 pt-1">
                        <div className="h-3 bg-surface-page rounded w-3/4" />
                        <div className="h-3 bg-surface-page rounded w-2/3" />
                        <div className="h-3 bg-surface-page rounded w-1/2" />
                      </div>
                      <div className="pt-3 flex items-center justify-between">
                        <div className="h-3.5 bg-surface-muted rounded w-24" />
                        <div className="h-6 bg-surface-muted rounded w-8" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="bg-white rounded-[12px] border border-status-danger-border p-10 text-center shadow-sm">
                <AlertCircle className="w-10 h-10 mx-auto text-status-danger mb-3" />
                <p className="text-[16px] font-bold text-ink">
                  Đã có sự cố tải dữ liệu
                </p>
                <p className="text-[13px] text-ink-muted mt-1.5">
                  {fetchError}
                </p>
                <button
                  type="button"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[8px] bg-client-primary text-white text-[14px] font-semibold hover:bg-client-primary-hover transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : tours.length === 0 ? (
              <div className="bg-white rounded-[12px] border border-border-subtle p-12 text-center shadow-sm">
                <p className="text-[16px] font-bold text-ink">
                  Không tìm thấy tour phù hợp với bộ lọc hiện tại
                </p>
                <p className="text-[13px] text-ink-muted mt-1.5">
                  Bạn vui lòng nới rộng khoảng giá, thay đổi ngày khởi hành hoặc
                  đặt lại bộ lọc để xem thêm các hành trình phù hợp.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="mt-5 px-5 py-2.5 rounded-[8px] bg-client-primary text-white text-[14px] font-semibold hover:bg-client-primary-hover transition-colors"
                >
                  Xem Tất Cả Tour
                </button>
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-200 ${
                  loading ? "opacity-60 pointer-events-none" : "opacity-100"
                }`}
              >
                {tours.map((tour) => (
                  <TourCard key={tour.id} tour={tour} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!fetchError && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={effectivePage <= 1}
                  onClick={() => navigateWithParams({ page: effectivePage - 1 })}
                  className="w-9 h-9 rounded-[8px] border border-border-strong bg-white flex items-center justify-center text-ink disabled:opacity-40 hover:border-client-primary hover:text-client-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const p = idx + 1;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => navigateWithParams({ page: p })}
                      className={`w-9 h-9 rounded-[8px] text-[14px] font-semibold border tabular-nums transition-colors ${
                        p === effectivePage
                          ? "bg-client-primary border-client-primary text-white"
                          : "bg-white border-border-strong text-ink hover:border-client-primary hover:text-client-primary"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={effectivePage >= totalPages}
                  onClick={() => navigateWithParams({ page: effectivePage + 1 })}
                  className="w-9 h-9 rounded-[8px] border border-border-strong bg-white flex items-center justify-center text-ink disabled:opacity-40 hover:border-client-primary hover:text-client-primary transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile Filter Drawer (Sticky Footer pinned at 375px / 820px) */}
      {!isDesktop && mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileFilterOpen(false)}
          />
          <aside className="relative z-10 w-[320px] max-w-[90vw] bg-white h-full flex flex-col shadow-[0_20px_48px_rgba(22,34,41,0.22)]">
            <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
              <h2 className="text-[18px] font-bold text-ink">Bộ Lọc</h2>
              <button
                type="button"
                aria-label="Đóng bộ lọc"
                onClick={() => setMobileFilterOpen(false)}
                className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="mobile-filter-form"
              onSubmit={handleApplyFilter}
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              {renderFilterFields("mobile-filter")}
            </form>

            <div className="shrink-0 border-t border-border-subtle bg-white px-5 py-3">
              {renderFilterActions("mobile-filter-form")}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
