"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Newspaper,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { SmartImage } from "@/components/client/SmartImage";
import type { ClientNewsItem } from "@/lib/client-data";
import { formatDateVN } from "@/lib/format";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1000&q=85";

export interface InitialNewsResult {
  articles: ClientNewsItem[];
  total: number;
  page: number;
  totalPages: number;
  categories: string[];
}

export function NewsListClient({
  initialResult,
  initialQueryKey,
}: {
  initialResult: InitialNewsResult;
  initialQueryKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlCategory = searchParams.get("category") || "";
  const urlKeyword = searchParams.get("keyword") || "";
  const urlPage = Math.max(1, Number(searchParams.get("page") || 1) || 1);

  const [keywordDraft, setKeywordDraft] = useState(urlKeyword);
  const [articles, setArticles] = useState<ClientNewsItem[]>(
    initialResult.articles
  );
  const [total, setTotal] = useState(initialResult.total);
  const [effectivePage, setEffectivePage] = useState(initialResult.page);
  const [totalPages, setTotalPages] = useState(
    Math.max(1, initialResult.totalPages)
  );
  const [categories, setCategories] = useState<string[]>(
    initialResult.categories
  );
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [lastKey, setLastKey] = useState(initialQueryKey);

  useEffect(() => {
    setKeywordDraft(urlKeyword);
  }, [urlKeyword]);

  useEffect(() => {
    const apiParams = new URLSearchParams();
    if (urlCategory) apiParams.set("category", urlCategory);
    if (urlKeyword) apiParams.set("keyword", urlKeyword);
    apiParams.set("page", String(urlPage));
    apiParams.set("limit", "7");

    const nextKey = apiParams.toString();
    if (nextKey === lastKey && retryNonce === 0) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/client/news?${nextKey}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch news");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLastKey(nextKey);
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        setTotal(Number(data.total || 0));
        setEffectivePage(Math.max(1, Number(data.page || 1)));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        if (Array.isArray(data.categories)) setCategories(data.categories);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(
            "Không thể tải danh sách tin tức lúc này. Vui lòng kiểm tra kết nối và thử lại."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlCategory, urlKeyword, urlPage, lastKey, retryNonce]);

  function navigateWithParams(
    overrides: Record<string, string | number | null>
  ) {
    const next = new URLSearchParams();
    const merged: Record<string, string | number | null> = {
      category: urlCategory,
      keyword: urlKeyword,
      page: 1,
      ...overrides,
    };

    for (const [k, v] of Object.entries(merged)) {
      if (v !== null && v !== "" && !(k === "page" && Number(v) === 1)) {
        next.set(k, String(v));
      }
    }

    const qs = next.toString();
    router.push(`/news${qs ? `?${qs}` : ""}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateWithParams({ keyword: keywordDraft.trim() || null, page: 1 });
  }

  const featuredLead =
    !urlCategory && !urlKeyword && effectivePage === 1 && articles.length > 0
      ? articles.find((a) => a.featured) || articles[0]
      : null;
  const gridArticles = featuredLead
    ? articles.filter((a) => a.id !== featuredLead.id)
    : articles;

  return (
    <>
      {/* Hero Banner */}
      <section className="relative h-[210px] sm:h-[260px] bg-[#1E103C] text-white overflow-hidden">
        <SmartImage
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1800&q=85"
          alt="Tin tức & Cẩm nang du lịch VN.TRAVEL"
          targetWidth={1800}
          quality={85}
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
        <div className="absolute inset-0 max-w-[1184px] mx-auto px-4 flex flex-col justify-end pb-7 sm:pb-9">
          <nav
            aria-label="Breadcrumb"
            className="text-[12px] sm:text-[13px] text-white/85 flex items-center gap-2 mb-2"
          >
            <Link href="/" className="hover:text-white hover:underline">
              Trang chủ
            </Link>
            <span>&gt;</span>
            <span className="font-medium text-white">Tin tức &amp; Cẩm nang</span>
          </nav>
          <h1 className="text-[24px] sm:text-[36px] font-bold leading-tight">
            Tin Tức &amp; Cẩm Nang Du Lịch
          </h1>
          <p className="text-[13px] sm:text-[15px] text-white/90 mt-1.5 max-w-[680px]">
            Cập nhật xu hướng xê dịch 2026, kinh nghiệm săn tour giá hời, bản đồ
            ẩm thực và lịch trình chi tiết từ đội ngũ VN.TRAVEL.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-[1184px] mx-auto px-4 py-8 space-y-7">
        {/* Search & Category Tabs Bar */}
        <div className="bg-white rounded-[14px] border border-[#ECECEC] p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateWithParams({ category: null, page: 1 })}
              className={`px-3.5 py-2 min-h-[40px] rounded-[8px] text-[13px] font-semibold whitespace-nowrap transition-colors ${
                !urlCategory
                  ? "bg-[#4502C7] text-white shadow-sm"
                  : "bg-[#F6F6F6] text-[#25282B] hover:bg-[#4502C7]/10 hover:text-[#4502C7]"
              }`}
            >
              Tất cả bài viết
            </button>
            {categories.map((cat) => {
              const active = urlCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => navigateWithParams({ category: cat, page: 1 })}
                  className={`px-3.5 py-2 min-h-[40px] rounded-[8px] text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#4502C7] text-white shadow-sm"
                      : "bg-[#F6F6F6] text-[#25282B] hover:bg-[#4502C7]/10 hover:text-[#4502C7]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 w-full lg:w-[340px] shrink-0"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                placeholder="Tìm bài viết, điểm đến..."
                aria-label="Tìm kiếm tin tức"
                className="w-full h-[42px] pl-9 pr-3 rounded-[8px] border border-[#CCD1D2] text-[13px] text-[#25282B] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
              />
            </div>
            <button
              type="submit"
              className="px-4 h-[42px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0"
            >
              Tìm
            </button>
          </form>
        </div>

        {/* Out-of-range page notice */}
        {total > 0 && urlPage > totalPages && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-2.5 text-[13px] text-amber-900">
            <span>
              Trang <strong>{urlPage}</strong> vượt quá tổng số{" "}
              <strong>{totalPages}</strong> trang — đang hiển thị trang{" "}
              {effectivePage}.
            </span>
            <button
              type="button"
              onClick={() => navigateWithParams({ page: 1 })}
              className="font-bold text-[#4502C7] hover:underline"
            >
              Về trang 1
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="rounded-[14px] bg-white border border-[#ECECEC] overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/10] bg-[#E9ECEF]" />
                <div className="p-5 space-y-3">
                  <div className="h-3.5 bg-[#E9ECEF] rounded w-1/3" />
                  <div className="h-5 bg-[#E9ECEF] rounded w-5/6" />
                  <div className="h-4 bg-[#F1F3F5] rounded w-full" />
                  <div className="h-4 bg-[#F1F3F5] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="bg-white rounded-[16px] border border-red-200 p-10 text-center shadow-sm">
            <AlertCircle className="w-10 h-10 mx-auto text-[#DA0808] mb-3" />
            <p className="text-[17px] font-bold text-[#25282B]">
              Đã có sự cố tải bài viết
            </p>
            <p className="text-[13px] text-[#667479] mt-1">{fetchError}</p>
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white text-[14px] font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-white rounded-[16px] border border-[#ECECEC] p-12 text-center shadow-sm">
            <Newspaper className="w-11 h-11 mx-auto text-[#667085] mb-3" />
            <p className="text-[17px] font-bold text-[#25282B]">
              Không tìm thấy bài viết phù hợp
            </p>
            <p className="text-[13px] text-[#667479] mt-1">
              Thử đổi từ khóa hoặc chọn lại chuyên mục khác để khám phá thêm nhiều
              cẩm nang du lịch hay nhé.
            </p>
            <button
              type="button"
              onClick={() => router.push("/news")}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white text-[14px] font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Xem Tất Cả Tin Tức</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured Highlight Banner Card */}
            {featuredLead && (
              <Link
                href={`/news/${featuredLead.slug}`}
                className="group grid grid-cols-1 lg:grid-cols-12 bg-white rounded-[16px] border border-[#ECECEC] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="lg:col-span-6 relative aspect-[16/10] lg:aspect-auto lg:min-h-[320px] bg-[#F3F4F6] overflow-hidden">
                  <SmartImage
                    src={featuredLead.avatar || FALLBACK_IMAGE}
                    alt={featuredLead.title}
                    targetWidth={1100}
                    quality={85}
                    priority
                    sizes="(max-width: 1024px) 100vw, 590px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFD600] text-[#1E103C] text-[12px] font-extrabold shadow">
                    <Sparkles className="w-3.5 h-3.5" />
                    TIN NỔI BẬT
                  </span>
                </div>

                <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#667479]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F3EEFF] text-[#4502C7] font-bold">
                      {featuredLead.category}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDateVN(featuredLead.publishedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {featuredLead.views.toLocaleString("vi-VN")} lượt đọc
                    </span>
                  </div>

                  <h2 className="mt-3 text-[22px] sm:text-[26px] font-bold text-[#25282B] group-hover:text-[#4502C7] leading-snug transition-colors">
                    {featuredLead.title}
                  </h2>

                  <p className="mt-3 text-[14px] text-[#667479] leading-relaxed line-clamp-4">
                    {featuredLead.excerpt}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#4502C7] group-hover:gap-2.5 transition-all">
                    <span>Đọc bài viết chi tiết</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            )}

            {/* Articles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {gridArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/news/${article.slug}`}
                  className="group bg-white rounded-[14px] border border-[#ECECEC] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                  <div className="relative aspect-[16/10] w-full bg-[#F3F4F6] overflow-hidden">
                    <SmartImage
                      src={article.avatar || FALLBACK_IMAGE}
                      alt={article.title}
                      targetWidth={760}
                      quality={82}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-sm text-white text-[11px] font-semibold">
                      {article.category}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2 text-[12px] text-[#667479]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateVN(article.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {article.views.toLocaleString("vi-VN")}
                      </span>
                    </div>

                    <h3 className="mt-2 text-[16px] sm:text-[17px] font-bold text-[#25282B] group-hover:text-[#4502C7] line-clamp-2 min-h-[46px] leading-snug transition-colors">
                      {article.title}
                    </h3>

                    <p className="mt-2 text-[13px] text-[#667479] line-clamp-3 leading-relaxed">
                      {article.excerpt}
                    </p>

                    <div className="mt-auto pt-4 flex items-center justify-between text-[13px] font-semibold text-[#4502C7]">
                      <span>Đọc tiếp</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {!fetchError && totalPages > 1 && (
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={effectivePage <= 1}
                  onClick={() => navigateWithParams({ page: effectivePage - 1 })}
                  className="w-10 h-10 rounded-[8px] border border-[#CCD1D2] bg-white flex items-center justify-center text-[#25282B] disabled:opacity-40 hover:border-[#4502C7] hover:text-[#4502C7]"
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
                      className={`w-10 h-10 rounded-[8px] text-[14px] font-semibold border transition-colors ${
                        p === effectivePage
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
                  disabled={effectivePage >= totalPages}
                  onClick={() => navigateWithParams({ page: effectivePage + 1 })}
                  className="w-10 h-10 rounded-[8px] border border-[#CCD1D2] bg-white flex items-center justify-center text-[#25282B] disabled:opacity-40 hover:border-[#4502C7] hover:text-[#4502C7]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
