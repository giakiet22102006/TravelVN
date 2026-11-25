import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Compass,
  Eye,
  Tag,
  User,
} from "lucide-react";
import { getClientNewsBySlug } from "@/lib/client-data";
import { formatDateVN } from "@/lib/format";
import { SmartImage } from "@/components/client/SmartImage";
import { TourCard } from "@/components/client/TourCard";
import { NewsViewTracker } from "@/components/client/NewsViewTracker";

export const dynamic = "force-dynamic";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=85";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getClientNewsBySlug(slug);
  if (!data) {
    return {
      title: "Bài viết không tồn tại | VN.TRAVEL",
    };
  }
  return {
    title: `${data.article.title} | Tin Tức VN.TRAVEL`,
    description: data.article.excerpt,
  };
}

function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 200));
}

function renderInlineText(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-client-soft text-client-primary font-bold text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderArticleBlocks(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (keyPrefix: number) => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${keyPrefix}`}
        className="my-4 space-y-2 pl-5 list-disc text-[15px] sm:text-[16px] text-ink leading-relaxed"
      >
        {bulletBuffer.map((item, idx) => (
          <li key={idx}>{renderInlineText(item)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets(idx);
      return;
    }

    if (line.startsWith("## ")) {
      flushBullets(idx);
      blocks.push(
        <h2
          key={`h2-${idx}`}
          className="mt-7 mb-3 text-[20px] sm:text-[22px] font-bold text-ink leading-snug"
        >
          {line.slice(3).trim()}
        </h2>
      );
      return;
    }

    if (line.startsWith("- ")) {
      bulletBuffer.push(line.slice(2).trim());
      return;
    }

    flushBullets(idx);
    blocks.push(
      <p
        key={`p-${idx}`}
        className="my-3.5 text-[15px] sm:text-[16px] text-ink leading-[1.8]"
      >
        {renderInlineText(line)}
      </p>
    );
  });

  flushBullets(lines.length);
  return blocks;
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getClientNewsBySlug(slug);

  if (!data) {
    notFound();
  }

  const { article, relatedNews, relatedTours } = data;
  const readMinutes = estimateReadingMinutes(article.content);

  return (
    <div className="max-w-[1184px] mx-auto px-4 py-6 sm:py-9">
      <NewsViewTracker slug={article.slug} />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted mb-5"
      >
        <Link href="/" className="hover:text-client-primary transition-colors">
          Trang chủ
        </Link>
        <span>&gt;</span>
        <Link href="/news" className="hover:text-client-primary transition-colors">
          Tin tức
        </Link>
        <span>&gt;</span>
        <span className="text-client-primary font-semibold line-clamp-1">
          {article.title}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Article Content */}
        <article className="lg:col-span-8 bg-white rounded-[16px] border border-border-subtle p-5 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-[12px] sm:text-[13px] text-ink-muted tabular-nums">
            <Link
              href={`/news?category=${encodeURIComponent(article.category)}`}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-client-soft text-client-primary font-bold hover:bg-client-primary hover:text-white transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{article.category}</span>
            </Link>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateVN(article.publishedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {readMinutes} phút đọc
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {article.views.toLocaleString("vi-VN")} lượt xem
            </span>
          </div>

          <h1 className="mt-4 text-[24px] sm:text-[32px] font-bold text-ink leading-tight">
            {article.title}
          </h1>

          {article.createdBy?.fullName && (
            <p className="mt-2.5 text-[13px] text-ink-muted inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-client-primary" />
              <span>
                Biên tập bởi{" "}
                <strong className="text-ink">
                  {article.createdBy.fullName}
                </strong>{" "}
                — VN.TRAVEL Editorial
              </span>
            </p>
          )}

          {/* Lead Excerpt */}
          <p className="mt-5 p-4 rounded-[12px] bg-surface-page border-l-4 border-client-primary text-[15px] text-ink font-medium leading-relaxed">
            {article.excerpt}
          </p>

          {/* Cover Image */}
          <div className="relative aspect-[16/9] w-full rounded-[12px] overflow-hidden my-6 bg-surface-muted">
            <SmartImage
              src={article.avatar || FALLBACK_IMAGE}
              alt={article.title}
              targetWidth={1280}
              quality={85}
              priority
              sizes="(max-width: 1024px) 100vw, 760px"
              className="object-cover"
            />
          </div>

          {/* Article Body */}
          <div className="prose-content">{renderArticleBlocks(article.content)}</div>

          {/* Footer CTA inside Article */}
          <div className="mt-8 pt-6 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/news"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-[8px] border border-border-strong hover:border-client-primary text-ink hover:text-client-primary text-[14px] font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại trang Tin Tức</span>
            </Link>

            {article.relatedDestination && (
              <Link
                href={`/tours?destination=${encodeURIComponent(
                  article.relatedDestination
                )}`}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white text-[14px] font-semibold transition-colors shadow-sm"
              >
                <Compass className="w-4 h-4" />
                <span>Xem Tour {article.relatedDestination}</span>
              </Link>
            )}
          </div>
        </article>

        {/* Right Sidebar: Related News & Quick Tour CTA */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-[116px]">
          {relatedNews.length > 0 && (
            <div className="bg-white rounded-[16px] border border-border-subtle p-5 shadow-sm">
              <h2 className="text-[18px] font-bold text-ink mb-4">
                Bài Viết Liên Quan
              </h2>
              <div className="space-y-4">
                {relatedNews.map((item) => (
                  <Link
                    key={item.id}
                    href={`/news/${item.slug}`}
                    className="group flex items-start gap-3 pb-4 last:pb-0 border-b last:border-b-0 border-border-subtle"
                  >
                    <div className="relative w-[92px] aspect-[16/10] rounded-[8px] overflow-hidden shrink-0 bg-surface-muted">
                      <SmartImage
                        src={item.avatar || FALLBACK_IMAGE}
                        alt={item.title}
                        targetWidth={280}
                        quality={80}
                        sizes="100px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-client-primary">
                        {item.category}
                      </span>
                      <h3 className="text-[13.5px] font-bold text-ink group-hover:text-client-primary transition-colors line-clamp-2 leading-snug mt-0.5">
                        {item.title}
                      </h3>
                      <span className="text-[11px] text-ink-muted block mt-1 tabular-nums">
                        {formatDateVN(item.publishedAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[16px] bg-client-deep border border-white/10 p-6 text-white shadow-md">
            <p className="text-[11px] font-bold uppercase tracking-widest text-client-sun">
              ƯU ĐÃI VN.TRAVEL
            </p>
            <h3 className="text-[20px] font-bold mt-1.5 leading-snug">
              Sẵn sàng lên lịch cho chuyến đi tiếp theo?
            </h3>
            <p className="text-[13px] text-white/90 mt-2 leading-relaxed">
              Dùng ngay mã <strong className="text-client-sun">GIAM10</strong>{" "}
              (giảm 10% tối đa 1.000.000đ) hoặc{" "}
              <strong className="text-client-sun">TOUR2026</strong> khi đặt tour
              trọn gói tại VN.TRAVEL.
            </p>
            <Link
              href={
                article.relatedDestination
                  ? `/tours?destination=${encodeURIComponent(
                      article.relatedDestination
                    )}`
                  : "/tours"
              }
              className="mt-4 inline-flex items-center justify-center gap-1.5 w-full min-h-[44px] rounded-[10px] bg-white text-client-primary hover:bg-client-sun hover:text-client-deep font-bold text-[14px] transition-colors"
            >
              <span>
                {article.relatedDestination
                  ? `Khám phá Tour ${article.relatedDestination}`
                  : "Khám phá tất cả Tour"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </aside>
      </div>

      {/* Bottom Related Tours Conversion Section */}
      {relatedTours.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-[22px] sm:text-[26px] font-bold text-ink">
              {article.relatedDestination
                ? `Tour Gợi Ý Dành Cho Bạn (${article.relatedDestination})`
                : "Tour Nổi Bật Dành Cho Bạn"}
            </h2>
            <Link
              href={
                article.relatedDestination
                  ? `/tours?destination=${encodeURIComponent(
                      article.relatedDestination
                    )}`
                  : "/tours"
              }
              className="text-[14px] font-semibold text-client-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Xem thêm tour</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {relatedTours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
