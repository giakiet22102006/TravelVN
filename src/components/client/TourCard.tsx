"use client";

import Link from "next/link";
import { Heart, Scale, Star, Zap } from "lucide-react";
import {
  calcDiscountPercent,
  formatCurrencyVND,
  formatDateVN,
} from "@/lib/format";
import type { TourDeparturePublic } from "@/types/ota";
import { SmartImage } from "./SmartImage";
import { useWishlist } from "./WishlistContext";
import { useCompare } from "./CompareContext";

export interface TourCardData {
  id: string;
  code: string;
  name: string;
  slug: string;
  avatar: string | null;
  priceAdult: number;
  priceChild?: number;
  priceBaby?: number;
  priceNewAdult: number;
  priceNewChild?: number;
  priceNewBaby?: number;
  stockAdult: number;
  stockChild?: number;
  stockBaby?: number;
  locations?: unknown;
  time: string;
  vehicle?: string;
  departureDate: string | Date | null;
  ratingAvg?: number;
  reviewCount?: number;
  durationDays?: number;
  hotelStar?: number;
  singleRoomSurcharge?: number;
  tags?: unknown;
  departures?: TourDeparturePublic[];
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function TourCard({ tour }: { tour: TourCardData }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { isInCompare, toggleTour } = useCompare();

  const discount = calcDiscountPercent(tour.priceAdult, tour.priceNewAdult);
  const displayPrice =
    tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;
  const wishlisted = isWishlisted(tour.id);
  const compared = isInCompare(tour.id);

  return (
    <Link
      href={`/tours/${tour.slug}`}
      className="group bg-white rounded-[12px] shadow-[0_2px_10px_rgba(22,34,41,0.06)] hover:shadow-[0_10px_24px_rgba(22,34,41,0.11)] border border-border-subtle hover:border-client-border overflow-hidden flex flex-col transition-[border-color,box-shadow] duration-200 font-lexend-deca"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-muted">
        <SmartImage
          src={tour.avatar}
          alt={tour.name}
          targetWidth={800}
          quality={82}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Top-Right Wishlist & Compare Overlay Actions */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            aria-label={wishlisted ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
            aria-pressed={wishlisted}
            title={wishlisted ? "Bỏ yêu thích" : "Yêu thích"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void toggleWishlist(tour);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(22,34,41,0.16)] transition-colors ${
              wishlisted
                ? "bg-client-accent text-white"
                : "bg-white/95 text-ink hover:text-client-accent hover:bg-white"
            }`}
          >
            <Heart className={`w-4 h-4 ${wishlisted ? "fill-white" : ""}`} />
          </button>

          <button
            type="button"
            aria-label={compared ? "Bỏ so sánh tour" : "Thêm vào so sánh tour"}
            aria-pressed={compared}
            title={compared ? "Đang so sánh" : "So sánh"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleTour(tour);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(22,34,41,0.16)] transition-colors ${
              compared
                ? "bg-client-primary text-white"
                : "bg-white/95 text-ink hover:text-client-primary hover:bg-white"
            }`}
          >
            <Scale className="w-4 h-4" />
          </button>
        </div>

        {discount > 0 && (
          <div className="absolute left-0 bottom-0 bg-client-accent text-white text-[11px] font-bold px-3 py-1.5 rounded-tr-[10px] inline-flex items-center gap-1 shadow-sm tabular-nums">
            <Zap className="w-3.5 h-3.5 fill-client-sun text-client-sun" />
            <span>Giảm -{discount}%</span>
          </div>
        )}
      </div>

      <div className="p-3.5 sm:p-4 flex-1 flex flex-col">
        <h3 className="text-[14px] sm:text-[15px] font-bold text-ink group-hover:text-client-primary transition-colors line-clamp-2 min-h-[42px] leading-snug">
          {tour.name}
        </h3>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5 tabular-nums">
          {discount > 0 && (
            <span className="text-[13px] font-medium text-ink-muted line-through tabular-nums">
              {formatCurrencyVND(tour.priceAdult)}
            </span>
          )}
          <span className="text-[16px] font-bold text-client-accent tabular-nums">
            {formatCurrencyVND(displayPrice)}
          </span>
        </div>

        <div className="mt-2.5 space-y-1 text-[12px] text-ink-muted">
          <p className="truncate">
            Mã Tour:{" "}
            <span className="font-semibold text-ink tabular-nums">{tour.code}</span>
          </p>
          <p className="truncate">
            Ngày Khởi Hành:{" "}
            <span className="font-semibold text-ink tabular-nums">
              {formatDateVN(tour.departureDate)}
            </span>
          </p>
          <p className="truncate">
            Thời Gian:{" "}
            <span className="font-semibold text-ink">
              {tour.time || "Liên hệ"}
            </span>
          </p>
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {(() => {
              const count = tour.reviewCount ?? 0;
              const avg = count > 0 ? (tour.ratingAvg ?? 5) : 0;
              const filledStars = count > 0 ? Math.round(avg) : 0;
              return (
                <>
                  <div className="flex items-center shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < filledStars
                            ? "fill-client-star text-client-star"
                            : "text-border-strong"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-ink-muted font-medium tabular-nums truncate">
                    {count > 0
                      ? `${avg.toFixed(1)} (${count})`
                      : "Tour mới"}
                  </span>
                </>
              );
            })()}
            {typeof tour.hotelStar === "number" && tour.hotelStar > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-client-soft text-client-primary border border-client-border text-[10.5px] font-bold tabular-nums shrink-0">
                {tour.hotelStar}★
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted shrink-0">
            <span>Số chỗ còn:</span>
            <span className="inline-flex items-center justify-center min-w-[26px] h-[24px] px-1.5 rounded-[5px] bg-client-accent text-white text-[12px] font-bold tabular-nums">
              {tour.stockAdult}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
