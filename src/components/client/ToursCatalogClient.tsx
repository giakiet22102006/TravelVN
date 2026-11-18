"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
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

  // API state initialized from SSR (prevents "0 Tour" flash & extra initial request)
  const [categoryInfo, setCategoryInfo] = useState<ClientCategoryFlatItem | null>(
    initialResult.categoryInfo
  );
  const [tours, setTours] = useState<TourCardData[]>(initialResult.tours);
  const [total, setTotal] = useState(initialResult.total);
  const [totalPages, setTotalPages] = useState(
    Math.max(1, initialResult.totalPages)
  );
  const [loading, setLoading] = useState(false);
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
    if (nextKey === lastFetchedKeyRef.current) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/client/tours?${nextKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        lastFetchedKeyRef.current = nextKey;
        setTours(Array.isArray(data.tours) ? data.tours : []);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        setCategoryInfo(data.categoryInfo ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setTours([]);
          setTotal(0);
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
    "Khám phá hàng loạt hành trình đặc sắc trong nước và quốc tế cùng 28.TRAVEL với lịch khởi hành liên tục, dịch vụ trọn gói 5 sao và ưu đãi hấp dẫn.";
  const bannerImage =
    categoryInfo?.avatar ||
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80";

  const renderFilterForm = (idPrefix: string) => (
    <form onSubmit={handleApplyFilter} className="space-y-4 text-[13px]">
      <div>
        <label
          htmlFor={`${idPrefix}-category`}
          className="block font-semibold text-[#25282B] mb-1.5"
        >
          Danh mục tour
        </label>
        <select
          id={`${idPrefix}-category`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-[#CCD1D2] bg-white text-[#25282B] focus:outline-none focus:border-[#4502C7]"
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
          className="block font-semibold text-[#25282B] mb-1.5"
        >
          Điểm đi
        </label>
        <select
          id={`${idPrefix}-departure-location`}
          value={departureLocation}
          onChange={(e) => setDepartureLocation(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-[#CCD1D2] bg-white text-[#25282B] focus:outline-none focus:border-[#4502C7]"
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
          className="block font-semibold text-[#25282B] mb-1.5"
        >
          Điểm đến
        </label>
        <input
          id={`${idPrefix}-destination`}
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="-- Nhập điểm đến --"
          className="w-full h-[40px] px-3 rounded-[8px] border border-[#CCD1D2] bg-white text-[#25282B] placeholder:text-[#99A2A5] focus:outline-none focus:border-[#4502C7]"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-departure-date`}
          className="block font-semibold text-[#25282B] mb-1.5"
        >
          Ngày khởi hành
        </label>
        <input
          id={`${idPrefix}-departure-date`}
          type="date"
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-[#CCD1D2] bg-white text-[#25282B] focus:outline-none focus:border-[#4502C7]"
        />
      </div>

      <div>
        <label className="block font-semibold text-[#25282B] mb-2">
          Số Lượng Hành Khách
        </label>
        <div className="space-y-2.5 bg-[#F6F6F6] p-3 rounded-[8px]">
          {[
            { label: "Người lớn:", value: adult, setter: setAdult },
            { label: "Trẻ em:", value: child, setter: setChild },
            { label: "Em bé:", value: baby, setter: setBaby },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-[#667479] font-medium">{row.label}</span>
              <input
                type="number"
                min={0}
                aria-label={row.label}
                value={row.value}
                onChange={(e) =>
                  row.setter(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-[74px] h-[34px] px-2 rounded-[6px] border border-[#CCD1D2] bg-white text-center font-semibold text-[#25282B] focus:outline-none focus:border-[#4502C7]"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-price`}
          className="block font-semibold text-[#25282B] mb-1.5"
        >
          Mức giá
        </label>
        <select
          id={`${idPrefix}-price`}
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className="w-full h-[40px] px-3 rounded-[8px] border border-[#CCD1D2] bg-white text-[#25282B] focus:outline-none focus:border-[#4502C7]"
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
          className="w-4 h-4 accent-[#4502C7] rounded"
        />
        <span className="font-semibold text-[#25282B]">
          Chỉ xem tour đang giảm giá
        </span>
      </label>

      <div className="pt-2 space-y-2">
        <button
          type="submit"
          className="w-full h-[42px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white font-semibold text-[14px] transition-colors"
        >
          Áp Dụng
        </button>
        <button
          type="button"
          onClick={handleResetFilter}
          className="w-full h-[38px] rounded-[8px] border border-[#CCD1D2] hover:border-[#4502C7] text-[#667479] hover:text-[#4502C7] font-medium text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors"
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
      <section className="relative h-[200px] sm:h-[250px] bg-[#1E103C] text-white overflow-hidden">
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
        <div className="bg-white rounded-[12px] border border-[#ECECEC] p-4 sm:p-5 mb-7 text-[14px] text-[#4F4F4F] leading-relaxed shadow-sm">
          {pageDescription}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Left Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 bg-white rounded-[12px] border border-[#ECECEC] p-5 shadow-sm sticky top-[125px]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#ECECEC]">
              <h2 className="text-[18px] font-bold text-[#4502C7] inline-flex items-center gap-2">
                <span>Bộ Lọc</span>
              </h2>
              <Filter className="w-4 h-4 text-[#4502C7]" />
            </div>
            {renderFilterForm("desktop-filter")}
          </aside>

          {/* Right Tour List */}
          <div className="lg:col-span-9">
            {/* Sort & Count Bar */}
            <div className="bg-white rounded-[12px] border border-[#ECECEC] p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold text-[#667479] mr-1">
                  Sắp xếp :
                </span>
                {SORT_TABS.map((tab) => {
                  const active =
                    tab.key === "deal"
                      ? urlSort === "deal" || urlDeal
                      : tab.key === ""
                      ? !urlSort && !urlDeal
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
                      className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${
                        active
                          ? "bg-[#4502C7] text-white"
                          : "bg-[#F6F6F6] text-[#25282B] hover:bg-[#4502C7]/10 hover:text-[#4502C7]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(true)}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#4502C7] text-white text-[13px] font-semibold"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Bộ Lọc</span>
                </button>

                <span className="text-[14px] text-[#667479]">
                  Tất cả:{" "}
                  <strong className="text-[#25282B] font-bold">
                    {loading ? "Đang tải..." : `${total} Tour`}
                  </strong>
                </span>
              </div>
            </div>

            {urlDeal && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-[#4502C7]/5 border border-[#4502C7]/20 px-4 py-2.5 text-[13px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#4502C7]">
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
                  className="text-[12px] font-semibold text-[#DA0808] hover:underline inline-flex items-center gap-1"
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
                    className="h-[360px] rounded-[12px] bg-white border border-[#ECECEC] animate-pulse"
                  />
                ))}
              </div>
            ) : tours.length === 0 ? (
              <div className="bg-white rounded-[12px] border border-[#ECECEC] p-12 text-center shadow-sm">
                <p className="text-[16px] font-bold text-[#25282B]">
                  Không tìm thấy tour phù hợp với bộ lọc hiện tại
                </p>
                <p className="text-[13px] text-[#667479] mt-1.5">
                  Bạn vui lòng nới rộng khoảng giá, thay đổi ngày khởi hành hoặc
                  đặt lại bộ lọc để xem thêm các hành trình phù hợp.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="mt-5 px-5 py-2.5 rounded-[8px] bg-[#4502C7] text-white text-[14px] font-semibold hover:bg-[#36019e] transition-colors"
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
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={urlPage <= 1}
                  onClick={() => navigateWithParams({ page: urlPage - 1 })}
                  className="w-9 h-9 rounded-[8px] border border-[#CCD1D2] bg-white flex items-center justify-center text-[#25282B] disabled:opacity-40 hover:border-[#4502C7] hover:text-[#4502C7]"
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
                      className={`w-9 h-9 rounded-[8px] text-[14px] font-semibold border transition-colors ${
                        p === urlPage
                          ? "bg-[#4502C7] border-[#4502C7] text-white"
                          : "bg-white border-[#CCD1D2] text-[#25282B] hover:border-[#4502C7]"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={urlPage >= totalPages}
                  onClick={() => navigateWithParams({ page: urlPage + 1 })}
                  className="w-9 h-9 rounded-[8px] border border-[#CCD1D2] bg-white flex items-center justify-center text-[#25282B] disabled:opacity-40 hover:border-[#4502C7] hover:text-[#4502C7]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile Filter Drawer (375px optimized) */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileFilterOpen(false)}
          />
          <aside className="relative z-10 w-[300px] max-w-[90vw] bg-white h-full p-5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#ECECEC]">
              <h2 className="text-[18px] font-bold text-[#4502C7]">Bộ Lọc</h2>
              <button
                type="button"
                aria-label="Đóng bộ lọc"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 text-[#667479]"
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
