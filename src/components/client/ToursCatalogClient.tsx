"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import {
  type ClientCategoryFlatItem,
  useClientMeta,
} from "@/components/client/ClientLayoutShell";
import { TourCard, type TourCardData } from "@/components/client/TourCard";
import { DatePickerInput } from "@/components/client/DatePickerInput";
import { SmartImage } from "@/components/client/SmartImage";

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

const PRICE_OPTIONS = [
  { value: "", label: "-- Chọn khoảng giá --" },
  { value: "under-2m", label: "Dưới 2 triệu" },
  { value: "2m-4m", label: "Từ 2 - 4 triệu" },
  { value: "4m-8m", label: "Từ 4 - 8 triệu" },
  { value: "over-8m", label: "Trên 8 triệu" },
];

const SORT_TABS = [
  { key: "price-asc", label: "Giá tăng dần" },
  { key: "price-desc", label: "Giá giảm dần" },
  { key: "deal", label: "Khuyến Mại Hot" },
  { key: "", label: "Xem tất cả" },
];

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

  // Read live URL parameters
  const urlCategory = searchParams.get("category") || "";
  const urlDestination =
    searchParams.get("destination") || searchParams.get("keyword") || "";
  const urlDepartureLocation = searchParams.get("departureLocation") || "";
  const urlDepartureDate = searchParams.get("departureDate") || "";
  const urlAdult = Number(searchParams.get("adult") || 0) || 0;
  const urlChild = Number(searchParams.get("child") || 0) || 0;
  const urlBaby = Number(searchParams.get("baby") || 0) || 0;
  const urlPriceRange = searchParams.get("priceRange") || "";
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
  const [adult, setAdult] = useState(urlAdult);
  const [child, setChild] = useState(urlChild);
  const [baby, setBaby] = useState(urlBaby);
  const [priceRange, setPriceRange] = useState(urlPriceRange);
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
    setAdult(urlAdult);
    setChild(urlChild);
    setBaby(urlBaby);
    setPriceRange(urlPriceRange);
    setDealOnly(urlDeal);
  }, [
    urlCategory,
    urlDestination,
    urlDepartureLocation,
    urlDepartureDate,
    urlAdult,
    urlChild,
    urlBaby,
    urlPriceRange,
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
    if (urlAdult > 0) apiParams.set("adult", String(urlAdult));
    if (urlChild > 0) apiParams.set("child", String(urlChild));
    if (urlBaby > 0) apiParams.set("baby", String(urlBaby));
    if (urlPriceRange) apiParams.set("priceRange", urlPriceRange);
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
    urlAdult,
    urlChild,
    urlBaby,
    urlPriceRange,
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
        adult: adult > 0 ? adult : null,
        child: child > 0 ? child : null,
        baby: baby > 0 ? baby : null,
        priceRange,
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
      adult,
      child,
      baby,
      priceRange,
      dealOnly,
      urlSort,
    ]
  );

  function handleApplyFilter(e: React.FormEvent) {
    e.preventDefault();
    setMobileFilterOpen(false);
    navigateWithParams({ page: 1 });
  }

  function handleResetFilter() {
    setCategory("");
    setDestination("");
    setDepartureLocation("");
    setDepartureDate("");
    setAdult(0);
    setChild(0);
    setBaby(0);
    setPriceRange("");
    setDealOnly(false);
    setMobileFilterOpen(false);
    router.push("/tours");
  }

  const pageTitle =
    categoryInfo?.name ||
    (urlDeal ? "Tour Ưu Đãi Giờ Chót" : "Tất Cả Tour Du Lịch");
  const pageDescription =
    categoryInfo?.description ||
    "Khám phá hàng loạt hành trình đặc sắc trong nước và quốc tế cùng VN.TRAVEL với lịch khởi hành liên tục, dịch vụ trọn gói 5 sao và ưu đãi hấp dẫn.";
  const bannerImage =
    categoryInfo?.avatar ||
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80";

  const renderFilterForm = (idPrefix: string) => (
    <form onSubmit={handleApplyFilter} className="space-y-4 text-[13px]">
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
          htmlFor={`${idPrefix}-departure-date`}
          className="block font-semibold text-ink mb-1.5"
        >
          Ngày khởi hành
        </label>
        <DatePickerInput
          variant="compact"
          inputId={`${idPrefix}-departure-date`}
          value={departureDate}
          onChange={setDepartureDate}
        />
      </div>

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

      <div>
        <label
          htmlFor={`${idPrefix}-price`}
          className="block font-semibold text-ink mb-1.5"
        >
          Mức giá
        </label>
        <select
          id={`${idPrefix}-price`}
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-border-strong bg-white text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
        >
          {PRICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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

      <div className="pt-2 space-y-2">
        <button
          type="submit"
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
    </form>
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
        <div className="bg-white rounded-[12px] border border-border-subtle p-4 sm:p-5 mb-7 text-[14px] text-ink-muted leading-relaxed shadow-sm">
          {pageDescription}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Left Filter Sidebar */}
          {isDesktop && (
            <aside className="hidden lg:block lg:col-span-3 bg-white rounded-[12px] border border-border-subtle p-5 shadow-sm sticky top-[125px]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
                <h2 className="text-[18px] font-bold text-ink inline-flex items-center gap-2">
                  <span>Bộ Lọc</span>
                </h2>
                <Filter className="w-4 h-4 text-client-primary" />
              </div>
              {renderFilterForm("desktop-filter")}
            </aside>
          )}

          {/* Right Tour List */}
          <div className="lg:col-span-9">
            {/* Sort & Count Bar */}
            <div className="bg-white rounded-[12px] border border-border-subtle p-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
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
                      className={`px-3.5 py-2 min-h-[38px] rounded-[8px] font-medium whitespace-nowrap transition-colors ${
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
                    {loading ? "..." : `${total} Tour`}
                  </strong>
                </span>
              </div>
            </div>

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

            {urlDeal && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-client-soft border border-client-border px-4 py-2.5 text-[13px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-client-primary">
                  <Tag className="w-4 h-4" />
                  Đang lọc: Chỉ hiển thị các tour có ưu đãi giảm giá
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigateWithParams({
                      deal: null,
                      sort: urlSort === "deal" ? null : urlSort || null,
                      page: 1,
                    })
                  }
                  className="text-[12px] font-semibold text-client-accent hover:text-client-accent-hover hover:underline inline-flex items-center gap-1 min-h-[36px] px-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Bỏ lọc ưu đãi
                </button>
              </div>
            )}

            {/* Tour Grid */}
            {loading ? (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

      {/* Mobile Filter Drawer (375px optimized) */}
      {!isDesktop && mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileFilterOpen(false)}
          />
          <aside className="relative z-10 w-[300px] max-w-[90vw] bg-white h-full p-5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
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
            {renderFilterForm("mobile-filter")}
          </aside>
        </div>
      )}
    </>
  );
}
