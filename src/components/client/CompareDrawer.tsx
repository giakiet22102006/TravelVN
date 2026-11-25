"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Car,
  Clock,
  Hotel,
  Scale,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCompare, MAX_COMPARE_ITEMS } from "./CompareContext";
import { SmartImage } from "./SmartImage";
import {
  calcDiscountPercent,
  formatCurrencyVND,
  formatDateVN,
} from "@/lib/format";
import { TOUR_TAG_LABELS } from "@/types/ota";

export function CompareDrawer() {
  const { items, removeTour, clearAll, drawerOpen, setDrawerOpen } =
    useCompare();

  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen, setDrawerOpen]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Sticky Compact Compare Bar (positioned left/center-left so right AI FAB never overlaps) */}
      <div
        role="region"
        aria-label="Thanh so sánh tour"
        className="fixed bottom-4 left-4 right-20 sm:right-auto sm:w-[540px] sm:max-w-[calc(100vw-112px)] z-30 bg-white/95 backdrop-blur-md rounded-[14px] border border-client-border shadow-[0_12px_32px_rgba(22,34,41,0.16)] px-3.5 py-2.5 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-[9px] bg-client-soft text-client-primary flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            {items.map((tour) => (
              <div
                key={tour.id}
                className="relative group flex items-center gap-1.5 bg-surface-page border border-border-subtle rounded-[8px] pl-1 pr-1.5 py-1 max-w-[130px] shrink-0"
              >
                <div className="relative w-7 h-5 rounded overflow-hidden bg-surface-muted shrink-0">
                  <SmartImage
                    src={tour.avatar}
                    alt={tour.name}
                    targetWidth={120}
                    quality={75}
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <span className="text-[11px] font-semibold text-ink truncate">
                  {tour.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeTour(tour.id)}
                  aria-label={`Bỏ ${tour.name} khỏi so sánh`}
                  className="text-ink-muted hover:text-status-danger transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-3 h-9 rounded-[9px] bg-client-primary hover:bg-client-primary-hover text-white text-[12px] font-bold transition-colors whitespace-nowrap tabular-nums shadow-sm"
          >
            So sánh ({items.length}/{MAX_COMPARE_ITEMS})
          </button>
          <button
            type="button"
            onClick={clearAll}
            aria-label="Xóa tất cả tour đang so sánh"
            className="w-9 h-9 rounded-[9px] border border-border-subtle text-ink-muted hover:text-status-danger hover:border-status-danger-border hover:bg-status-danger-bg flex items-center justify-center transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {drawerOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDrawerOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/55 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-modal-title"
            className="w-full max-w-[1040px] max-h-[90vh] bg-white rounded-[18px] border border-border-subtle shadow-[0_24px_60px_rgba(22,34,41,0.24)] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-3 bg-surface-page">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-client-primary text-white flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="compare-modal-title"
                    className="text-[17px] sm:text-[19px] font-bold text-ink"
                  >
                    So Sánh Chi Tiết Tour ({items.length}/{MAX_COMPARE_ITEMS})
                  </h2>
                  <p className="text-[12px] text-ink-muted">
                    Đối chiếu giá vé, lịch trình, tiêu chuẩn khách sạn và quyền lợi đi kèm
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-3 py-1.5 rounded-[8px] border border-border-subtle text-[12px] font-semibold text-ink-muted hover:text-status-danger hover:border-status-danger-border transition-colors"
                >
                  Xóa tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Đóng bảng so sánh"
                  className="w-9 h-9 rounded-[9px] border border-border-subtle hover:bg-surface-muted text-ink flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border-subtle align-top">
                      <th className="w-[155px] py-3 pr-4 text-[12.5px] font-bold text-ink-muted uppercase tracking-wide">
                        Tiêu chí
                      </th>
                      {items.map((tour) => (
                        <th key={tour.id} className="pb-4 px-3 min-w-[200px]">
                          <div className="relative rounded-[12px] border border-border-subtle bg-surface-page/70 p-3 space-y-2.5">
                            <button
                              type="button"
                              onClick={() => removeTour(tour.id)}
                              aria-label={`Bỏ ${tour.name}`}
                              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/95 border border-border-subtle text-ink-muted hover:text-status-danger flex items-center justify-center shadow-sm transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="relative aspect-[16/10] w-full rounded-[8px] overflow-hidden bg-surface-muted">
                              <SmartImage
                                src={tour.avatar}
                                alt={tour.name}
                                targetWidth={420}
                                quality={80}
                                sizes="240px"
                                className="object-cover"
                              />
                            </div>
                            <Link
                              href={`/tours/${tour.slug}`}
                              onClick={() => setDrawerOpen(false)}
                              className="block text-[13.5px] font-bold text-ink hover:text-client-primary transition-colors line-clamp-2 leading-snug min-h-[38px]"
                            >
                              {tour.name}
                            </Link>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border-subtle text-[13px]">
                    {/* Price & Discount */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        Giá vé người lớn
                      </td>
                      {items.map((tour) => {
                        const discount = calcDiscountPercent(
                          tour.priceAdult,
                          tour.priceNewAdult
                        );
                        const price =
                          tour.priceNewAdult > 0
                            ? tour.priceNewAdult
                            : tour.priceAdult;
                        return (
                          <td key={tour.id} className="py-3.5 px-3 tabular-nums">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-[16px] font-extrabold text-client-accent">
                                {formatCurrencyVND(price)}
                              </span>
                              {discount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-client-accent/10 text-client-accent text-[11px] font-bold">
                                  -{discount}%
                                </span>
                              )}
                            </div>
                            {discount > 0 && (
                              <span className="text-[12px] text-ink-muted line-through">
                                {formatCurrencyVND(tour.priceAdult)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Duration */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-client-primary" />
                          Thời lượng
                        </span>
                      </td>
                      {items.map((tour) => (
                        <td key={tour.id} className="py-3.5 px-3 font-medium text-ink">
                          {tour.time ||
                            (tour.durationDays ? `${tour.durationDays} ngày` : "Đang cập nhật")}
                        </td>
                      ))}
                    </tr>

                    {/* Departure Date */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-client-primary" />
                          Ngày khởi hành
                        </span>
                      </td>
                      {items.map((tour) => (
                        <td
                          key={tour.id}
                          className="py-3.5 px-3 font-medium text-ink tabular-nums"
                        >
                          {formatDateVN(tour.departureDate)}
                        </td>
                      ))}
                    </tr>

                    {/* Vehicle */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 text-client-primary" />
                          Phương tiện
                        </span>
                      </td>
                      {items.map((tour) => (
                        <td key={tour.id} className="py-3.5 px-3 text-ink">
                          {tour.vehicle || "Ô tô / Máy bay"}
                        </td>
                      ))}
                    </tr>

                    {/* Hotel Star */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Hotel className="w-3.5 h-3.5 text-client-primary" />
                          Khách sạn
                        </span>
                      </td>
                      {items.map((tour) => {
                        const stars = tour.hotelStar ?? 4;
                        return (
                          <td key={tour.id} className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-ink tabular-nums">
                              {stars} sao
                              <Star className="w-3.5 h-3.5 fill-client-star text-client-star" />
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Single Room Surcharge */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        Phụ thu phòng đơn
                      </td>
                      {items.map((tour) => (
                        <td
                          key={tour.id}
                          className="py-3.5 px-3 font-medium text-ink tabular-nums"
                        >
                          {formatCurrencyVND(tour.singleRoomSurcharge ?? 500000)}
                        </td>
                      ))}
                    </tr>

                    {/* Tags */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-client-primary" />
                          Đặc điểm
                        </span>
                      </td>
                      {items.map((tour) => {
                        const tags = Array.isArray(tour.tags)
                          ? (tour.tags as string[]).filter(Boolean)
                          : [];
                        return (
                          <td key={tour.id} className="py-3.5 px-3">
                            {tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {tags.map((code) => (
                                  <span
                                    key={code}
                                    className="px-2 py-0.5 rounded-full bg-client-soft text-client-primary border border-client-border text-[11px] font-semibold"
                                  >
                                    {TOUR_TAG_LABELS[code] || code}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-ink-muted">Tiêu chuẩn</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Rating */}
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-ink-muted">
                        Đánh giá
                      </td>
                      {items.map((tour) => {
                        const count = tour.reviewCount ?? 0;
                        const avg = count > 0 ? tour.ratingAvg ?? 5 : 0;
                        return (
                          <td key={tour.id} className="py-3.5 px-3 tabular-nums">
                            {count > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                                <Star className="w-3.5 h-3.5 fill-client-star text-client-star" />
                                {avg.toFixed(1)} ({count} đánh giá)
                              </span>
                            ) : (
                              <span className="text-ink-muted">Tour mới</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* CTA */}
                    <tr>
                      <td className="py-4 pr-4 font-semibold text-ink-muted">
                        Đặt tour
                      </td>
                      {items.map((tour) => (
                        <td key={tour.id} className="py-4 px-3">
                          <Link
                            href={`/tours/${tour.slug}`}
                            onClick={() => setDrawerOpen(false)}
                            className="inline-flex items-center justify-center gap-1.5 w-full h-10 px-4 rounded-[9px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-bold transition-colors"
                          >
                            <span>Đặt Tour Ngay</span>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
