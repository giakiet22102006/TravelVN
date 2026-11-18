"use client";

import Link from "next/link";
import { Star, Zap } from "lucide-react";
import {
  calcDiscountPercent,
  formatCurrencyVND,
  formatDateVN,
} from "@/lib/format";
import { SmartImage } from "./SmartImage";

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
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80";

export function TourCard({ tour }: { tour: TourCardData }) {
  const discount = calcDiscountPercent(tour.priceAdult, tour.priceNewAdult);
  const displayPrice =
    tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;

  return (
    <Link
      href={`/tours/${tour.slug}`}
      className="group bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_10px_24px_rgba(69,2,199,0.14)] border border-[#ECECEC] overflow-hidden flex flex-col transition-all duration-200 font-lexend-deca"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F6F6F6]">
        <SmartImage
          src={tour.avatar}
          alt={tour.name}
          targetWidth={800}
          quality={82}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {discount > 0 && (
          <div className="absolute left-0 bottom-0 bg-[#DA0808] text-white text-[11px] font-bold px-3 py-1.5 rounded-tr-[10px] inline-flex items-center gap-1 shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
            <span>Giảm -{discount}%</span>
          </div>
        )}
      </div>

      <div className="p-3.5 sm:p-4 flex-1 flex flex-col">
        <h3 className="text-[14px] sm:text-[15px] font-bold text-[#25282B] group-hover:text-[#4502C7] transition-colors line-clamp-2 min-h-[42px] leading-snug">
          {tour.name}
        </h3>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
          {discount > 0 && (
            <span className="text-[13px] font-medium text-[#667479] line-through">
              {formatCurrencyVND(tour.priceAdult)}
            </span>
          )}
          <span className="text-[16px] font-bold text-[#DA0808]">
            {formatCurrencyVND(displayPrice)}
          </span>
        </div>

        <div className="mt-2.5 space-y-1 text-[12px] text-[#667479]">
          <p className="truncate">
            Mã Tour:{" "}
            <span className="font-semibold text-[#25282B]">{tour.code}</span>
          </p>
          <p className="truncate">
            Ngày Khởi Hành:{" "}
            <span className="font-semibold text-[#25282B]">
              {formatDateVN(tour.departureDate)}
            </span>
          </p>
          <p className="truncate">
            Thời Gian:{" "}
            <span className="font-semibold text-[#25282B]">
              {tour.time || "Liên hệ"}
            </span>
          </p>
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {(() => {
              const count = tour.reviewCount ?? 0;
              const avg = count > 0 ? (tour.ratingAvg ?? 5) : 5;
              const filledStars = Math.round(avg);
              return (
                <>
                  <div className="flex items-center text-[#FFB800]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < filledStars
                            ? "fill-[#FFB800]"
                            : "text-[#D4D8DD]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#667479] font-medium">
                    {count > 0
                      ? `${avg.toFixed(1)} (${count})`
                      : "(Mới)"}
                  </span>
                </>
              );
            })()}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#667479]">
            <span>Số chỗ còn:</span>
            <span className="inline-flex items-center justify-center min-w-[26px] h-[24px] px-1.5 rounded-[5px] bg-[#DA0808] text-white text-[12px] font-bold">
              {tour.stockAdult}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
