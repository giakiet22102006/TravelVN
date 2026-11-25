"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bus,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Ticket,
  XCircle,
} from "lucide-react";
import { useCart } from "@/components/client/CartContext";
import { TourCard, type TourCardData } from "@/components/client/TourCard";
import { TourReviewsSection } from "@/components/client/TourReviewsSection";
import { SmartImage } from "@/components/client/SmartImage";
import {
  calcDiscountPercent,
  formatCurrencyVND,
  formatDateVN,
} from "@/lib/format";
import type { TourAiReviewSummary } from "@/lib/ai";
import type { RatingBreakdownMap, TourReviewItem } from "@/lib/client-data";

interface ScheduleItem {
  title: string;
  description: string;
}

export interface TourDetailData extends TourCardData {
  information: string | null;
  images: unknown;
  schedules: unknown;
  priceChild: number;
  priceBaby: number;
  priceNewChild: number;
  priceNewBaby: number;
  stockChild: number;
  stockBaby: number;
  aiReviewSummary?: TourAiReviewSummary | unknown | null;
  category: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    parent?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
}

const DEFAULT_BREAKDOWN: RatingBreakdownMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=80";

export function TourDetailClient({
  tour,
  relatedTours,
  initialReviews = [],
  ratingBreakdown = DEFAULT_BREAKDOWN,
}: {
  tour: TourDetailData;
  relatedTours: TourCardData[];
  initialReviews?: TourReviewItem[];
  ratingBreakdown?: RatingBreakdownMap;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [liveRatingStats, setLiveRatingStats] = useState({
    ratingAvg: tour.ratingAvg ?? 5.0,
    reviewCount: tour.reviewCount ?? 0,
  });

  const locationsList = useMemo(() => {
    const locs = Array.isArray(tour.locations)
      ? (tour.locations as string[]).filter(Boolean)
      : [];
    return locs.length > 0 ? locs : ["Hà Nội"];
  }, [tour.locations]);

  const galleryImages = useMemo(() => {
    const imgs = Array.isArray(tour.images)
      ? (tour.images as string[]).filter(Boolean)
      : [];
    const combined = [tour.avatar, ...imgs].filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );

    const seenKeys = new Set<string>();
    const unique: string[] = [];
    for (const rawUrl of combined) {
      // Deduplicate same CDN asset even when URL query widths/qualities differ
      const dedupeKey = /^https?:\/\//i.test(rawUrl)
        ? rawUrl.split("?")[0]
        : rawUrl;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      unique.push(rawUrl);
    }

    return unique.length > 0 ? unique : [FALLBACK_IMAGE];
  }, [tour.avatar, tour.images]);

  const schedulesList = useMemo<ScheduleItem[]>(() => {
    if (!Array.isArray(tour.schedules)) return [];
    return (tour.schedules as ScheduleItem[]).filter(
      (s) => s && (s.title || s.description)
    );
  }, [tour.schedules]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expandedInfo, setExpandedInfo] = useState(false);

  // Booking Box State
  const [departureLocation, setDepartureLocation] = useState(
    locationsList[0] || "Hà Nội"
  );
  const [qtyAdult, setQtyAdult] = useState(tour.stockAdult > 0 ? 1 : 0);
  const [qtyChild, setQtyChild] = useState(0);
  const [qtyBaby, setQtyBaby] = useState(0);
  const [qtyHint, setQtyHint] = useState<string | null>(null);
  const [bookingFeedback, setBookingFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const minAdult = tour.stockAdult > 0 ? 1 : 0;

  function scrollToBookingBox() {
    const el = document.getElementById("booking-box");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const unitAdult =
    tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;
  const unitChild =
    tour.priceNewChild > 0 ? tour.priceNewChild : tour.priceChild;
  const unitBaby = tour.priceNewBaby > 0 ? tour.priceNewBaby : tour.priceBaby;
  const totalAmount =
    qtyAdult * unitAdult + qtyChild * unitChild + qtyBaby * unitBaby;
  const discount = calcDiscountPercent(tour.priceAdult, tour.priceNewAdult);

  function addCurrentSelectionToCart(redirectToCart = false) {
    if (qtyAdult + qtyChild + qtyBaby <= 0) {
      setBookingFeedback({
        type: "error",
        text: "Vui lòng chọn ít nhất 1 hành khách trước khi thêm vào giỏ hàng",
      });
      return;
    }

    const added = addItem({
      tourId: tour.id,
      slug: tour.slug,
      code: tour.code,
      name: tour.name,
      avatar: tour.avatar,
      departureDate: tour.departureDate ? String(tour.departureDate) : null,
      departureLocation,
      priceNewAdult: unitAdult,
      priceNewChild: unitChild,
      priceNewBaby: unitBaby,
      stockAdult: tour.stockAdult,
      stockChild: tour.stockChild,
      stockBaby: tour.stockBaby,
      quantityAdult: qtyAdult,
      quantityChild: qtyChild,
      quantityBaby: qtyBaby,
    });

    if (!added) {
      setBookingFeedback({
        type: "error",
        text: "Số chỗ còn lại của tour này đã được chọn hết trong giỏ hàng.",
      });
      return;
    }

    if (redirectToCart) {
      router.push("/cart");
      return;
    }

    setBookingFeedback({
      type: "success",
      text: "Đã thêm tour vào giỏ hàng!",
    });
  }

  return (
    <div className="max-w-[1184px] mx-auto px-4 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted mb-3"
      >
        <Link href="/" className="hover:text-client-primary transition-colors">
          Trang chủ
        </Link>
        {tour.category?.parent && (
          <>
            <span>&gt;</span>
            <Link
              href={`/tours?category=${encodeURIComponent(
                tour.category.parent.slug
              )}`}
              className="hover:text-client-primary transition-colors"
            >
              {tour.category.parent.name}
            </Link>
          </>
        )}
        {tour.category && (
          <>
            <span>&gt;</span>
            <Link
              href={`/tours?category=${encodeURIComponent(tour.category.slug)}`}
              className="hover:text-client-primary transition-colors"
            >
              {tour.category.name}
            </Link>
          </>
        )}
        <span>&gt;</span>
        <span className="text-client-primary font-semibold line-clamp-1">
          {tour.name}
        </span>
      </nav>

      {/* Main Tour Heading (H1) */}
      <h1 className="text-[22px] sm:text-[26px] font-bold text-ink leading-snug mb-4">
        {tour.name}
      </h1>

      {/* Main Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column: Gallery, Info, Schedule */}
        <div className="lg:col-span-7 space-y-6">
          {/* Gallery */}
          <div className="bg-white rounded-[14px] p-3 sm:p-4 border border-border-subtle shadow-sm">
            <div className="relative aspect-[16/10] w-full rounded-[10px] overflow-hidden bg-surface-muted">
              <SmartImage
                src={galleryImages[activeImageIndex] || FALLBACK_IMAGE}
                alt={tour.name}
                targetWidth={1200}
                quality={85}
                priority
                sizes="(max-width: 1024px) 100vw, 680px"
                className="object-cover"
              />
              {discount > 0 && (
                <span className="absolute top-3 left-3 bg-client-accent text-white text-[12px] font-bold px-3 py-1 rounded-full shadow tabular-nums">
                  Giảm -{discount}%
                </span>
              )}

              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Ảnh trước"
                    onClick={() =>
                      setActiveImageIndex((prev) =>
                        prev === 0 ? galleryImages.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Ảnh tiếp theo"
                    onClick={() =>
                      setActiveImageIndex((prev) =>
                        prev === galleryImages.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={imgUrl + idx}
                    type="button"
                    aria-label={`Xem ảnh ${idx + 1}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative aspect-[16/10] rounded-[8px] overflow-hidden border-2 transition-[border-color,opacity] ${
                      idx === activeImageIndex
                        ? "border-client-primary shadow-sm"
                        : "border-transparent opacity-75 hover:opacity-100"
                    }`}
                  >
                    <SmartImage
                      src={imgUrl}
                      alt={`${tour.name} ${idx + 1}`}
                      targetWidth={320}
                      quality={80}
                      sizes="150px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile/Tablet Quick Price & Booking Jump Card (m4) */}
          <div className="lg:hidden bg-white rounded-[14px] p-4 border border-client-border shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
                {discount > 0 && (
                  <span className="text-[13px] text-ink-muted line-through tabular-nums">
                    {formatCurrencyVND(tour.priceAdult)}
                  </span>
                )}
                <span className="text-[20px] font-extrabold text-client-accent tabular-nums">
                  {formatCurrencyVND(unitAdult)}
                </span>
                <span className="text-[12px] text-ink-muted">/ khách</span>
              </div>
              <p className="text-[12px] text-ink-muted mt-0.5 tabular-nums">
                Khởi hành:{" "}
                <strong className="text-ink">
                  {formatDateVN(tour.departureDate)}
                </strong>{" "}
                · Còn{" "}
                <strong className="text-client-accent">{tour.stockAdult}</strong>{" "}
                chỗ người lớn
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToBookingBox}
              className="px-4 min-h-[44px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-bold shadow-sm transition-colors whitespace-nowrap"
            >
              Chọn Vé &amp; Đặt Ngay
            </button>
          </div>

          {/* Thông Tin Tour */}
          <div className="bg-white rounded-[14px] p-5 sm:p-6 border border-border-subtle shadow-sm">
            <h2 className="text-[20px] font-bold text-ink mb-4">
              Thông Tin Tour
            </h2>
            <div
              className={`text-[14px] text-ink-muted leading-relaxed whitespace-pre-line ${
                !expandedInfo ? "line-clamp-6" : ""
              }`}
            >
              {tour.information ||
                "Hành trình du lịch trọn gói tiêu chuẩn 5 sao cùng đội ngũ hướng dẫn viên chuyên nghiệp từ VN.TRAVEL."}
            </div>

            {(tour.information?.length || 0) > 220 && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setExpandedInfo((v) => !v)}
                  className="px-5 py-2 rounded-[8px] border border-client-primary text-client-primary hover:bg-client-primary hover:text-white text-[13px] font-semibold transition-colors"
                >
                  {expandedInfo ? "Thu gọn" : "Xem tất cả"}
                </button>
              </div>
            )}
          </div>

          {/* Lịch Trình Tour */}
          <div className="bg-white rounded-[14px] p-5 sm:p-6 border border-border-subtle shadow-sm">
            <h2 className="text-[20px] font-bold text-ink mb-5">
              Lịch Trình Tour
            </h2>

            {schedulesList.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                Lịch trình chi tiết đang được cập nhật.
              </p>
            ) : (
              <div className="relative pl-5 border-l-2 border-client-border space-y-6">
                {schedulesList.map((sch, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-client-primary ring-4 ring-client-primary/15" />
                    <div className="inline-block bg-client-primary text-white text-[13px] font-semibold px-3.5 py-1.5 rounded-[8px] mb-2.5">
                      {sch.title}
                    </div>
                    <div className="bg-surface-page border border-border-subtle/70 rounded-[10px] p-4 text-[14px] text-ink-muted leading-relaxed whitespace-pre-line">
                      {sch.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dịch vụ Bao gồm & Không bao gồm (M4) */}
          <div className="bg-white rounded-[14px] p-5 sm:p-6 border border-border-subtle shadow-sm">
            <h2 className="text-[20px] font-bold text-ink mb-4">
              Dịch Vụ Bao Gồm &amp; Lưu Ý
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13.5px]">
              <div className="rounded-[12px] bg-status-success-bg/75 border border-status-success-border p-4 space-y-2">
                <p className="font-bold text-status-success inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Giá tour bao gồm</span>
                </p>
                <ul className="space-y-1.5 text-ink list-disc pl-5 leading-relaxed">
                  <li>
                    Phương tiện di chuyển theo chương trình ({tour.vehicle || "Xe du lịch đời mới"}).
                  </li>
                  <li>Lưu trú khách sạn tiêu chuẩn 3–5 sao (2 khách/phòng).</li>
                  <li>Các bữa ăn chính và ăn sáng buffet theo lịch trình.</li>
                  <li>Vé vào cổng các điểm tham quan chính &amp; hướng dẫn viên suốt tuyến.</li>
                  <li>Bảo hiểm du lịch trọn gói &amp; nước suối phục vụ hàng ngày.</li>
                </ul>
              </div>

              <div className="rounded-[12px] bg-status-warn-bg/75 border border-status-warn-border p-4 space-y-2">
                <p className="font-bold text-status-warn inline-flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Giá tour không bao gồm</span>
                </p>
                <ul className="space-y-1.5 text-ink list-disc pl-5 leading-relaxed">
                  <li>Chi phí cá nhân: giặt ủi, đồ uống ngoài thực đơn, mua sắm.</li>
                  <li>Phụ thu phòng đơn (nếu đi 1 mình hoặc yêu cầu ở riêng).</li>
                  <li>Vé cáp treo / trò chơi tự túc ngoài mục bao gồm của từng ngày.</li>
                  <li>Tiền bồi dưỡng (tip) cho tài xế và hướng dẫn viên (không bắt buộc).</li>
                  <li>Thuế VAT 8–10% khi xuất hóa đơn GTGT doanh nghiệp (nếu có yêu cầu).</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-[12px] bg-client-soft/60 border border-client-border p-4 text-[13px] text-ink-muted space-y-2">
              <p className="font-bold text-client-primary inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Chính Sách Hoàn / Hủy &amp; Đổi Lịch Khởi Hành</span>
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 list-disc pl-5 text-ink">
                <li>Hủy trước ngày khởi hành từ <strong>15 ngày</strong> trở lên: Hoàn 100% tiền cọc (hoặc đổi ngày miễn phí).</li>
                <li>Hủy trước từ <strong>7 đến 14 ngày</strong>: Phí hủy 30% tổng giá trị tour.</li>
                <li>Hủy trước từ <strong>3 đến 6 ngày</strong>: Phí hủy 50% tổng giá trị tour.</li>
                <li>Hủy trong vòng <strong>48 giờ</strong> trước khởi hành: Không hoàn phí cọc (trừ trường hợp bất khả kháng).</li>
              </ul>
              <p className="pt-1 text-[12px] text-ink-muted">
                Khách hàng vui lòng thông báo sớm tối thiểu <strong>7 ngày</strong> (tour trong nước) và{" "}
                <strong>14 ngày</strong> (tour nước ngoài) để được hỗ trợ giữ chỗ / đổi lịch thuận lợi nhất. Xem đầy đủ tại{" "}
                <Link href="/terms" className="text-client-primary font-semibold hover:underline">
                  Điều khoản dịch vụ &amp; Chính sách đặt tour
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Booking Box "Chuyến Đi Của Bạn" */}
        <div id="booking-box" className="lg:col-span-5 lg:sticky lg:top-[112px] scroll-mt-28">
          <div className="bg-white rounded-[14px] p-4 sm:p-5 border border-border-subtle shadow-md">
            <h2 className="text-[19px] font-bold text-ink mb-3">
              Chuyến Đi Của Bạn
            </h2>

            {/* Tour Mini Card */}
            <div className="flex gap-3 pb-3 border-b border-border-subtle">
              <div className="relative w-[100px] h-[70px] rounded-[8px] overflow-hidden shrink-0 bg-surface-muted">
                <SmartImage
                  src={tour.avatar || FALLBACK_IMAGE}
                  alt={tour.name}
                  targetWidth={240}
                  quality={80}
                  sizes="100px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-ink line-clamp-2 leading-snug">
                  {tour.name}
                </h3>
                <a
                  href="#tour-reviews"
                  className="mt-1 flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          liveRatingStats.reviewCount > 0 &&
                          i < Math.round(liveRatingStats.ratingAvg)
                            ? "fill-client-star text-client-star"
                            : "text-border-strong"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] text-ink-muted font-medium tabular-nums">
                    {liveRatingStats.reviewCount > 0
                      ? `${liveRatingStats.ratingAvg.toFixed(1)} (${liveRatingStats.reviewCount} lượt đánh giá)`
                      : "Chưa có đánh giá"}
                  </span>
                </a>
              </div>
            </div>

            {/* Tour Metadata Specs */}
            <div className="py-3 border-b border-border-subtle space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-muted inline-flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-client-primary" />
                  Mã Tour:
                </span>
                <span className="font-semibold text-client-primary tabular-nums">{tour.code}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-muted inline-flex items-center gap-2">
                  <Clock className="w-4 h-4 text-client-primary" />
                  Thời Gian:
                </span>
                <span className="font-semibold text-ink">
                  {tour.time || "Đang cập nhật"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-muted inline-flex items-center gap-2">
                  <Bus className="w-4 h-4 text-client-primary" />
                  Phương Tiện:
                </span>
                <span className="font-semibold text-ink">
                  {tour.vehicle || "Ô tô / Máy bay"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-muted inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-client-primary" />
                  Ngày Khởi Hành:
                </span>
                <span className="font-semibold text-ink tabular-nums">
                  {formatDateVN(tour.departureDate)}
                </span>
              </div>
            </div>

            {/* Departure Location Select */}
            <div className="py-3 border-b border-border-subtle">
              <label
                htmlFor="detail-departure-location"
                className="block text-[13px] font-semibold text-ink mb-1.5"
              >
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-client-primary" />
                  Khởi Hành Tại:
                </span>
              </label>
              <select
                id="detail-departure-location"
                value={departureLocation}
                onChange={(e) => setDepartureLocation(e.target.value)}
                className="w-full h-[38px] px-3 rounded-[8px] border border-border-strong bg-white text-[13px] font-medium text-ink focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
              >
                {locationsList.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Passenger Quantities */}
            <div className="py-3 border-b border-border-subtle space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink">
                  Số Lượng Hành Khách
                </p>
                {discount > 0 && (
                  <div className="text-[12px] flex items-center gap-1.5 tabular-nums">
                    <span className="text-ink-muted">Giá gốc:</span>
                    <span className="text-ink-muted line-through">
                      {formatCurrencyVND(tour.priceAdult)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-client-accent/10 text-client-accent font-bold text-[11px] tabular-nums">
                      -{discount}%
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-ink-muted tabular-nums">
                Chỗ còn theo hạng vé: {tour.stockAdult} Người lớn ·{" "}
                {tour.stockChild} Trẻ em · {tour.stockBaby} Em bé
              </p>

              {[
                {
                  name: "Người lớn",
                  label: "Người lớn:",
                  oldPrice: tour.priceAdult,
                  unitPrice: unitAdult,
                  qty: qtyAdult,
                  minQty: minAdult,
                  stock: tour.stockAdult,
                  setQty: setQtyAdult,
                },
                {
                  name: "Trẻ em",
                  label: "Trẻ em:",
                  oldPrice: tour.priceChild,
                  unitPrice: unitChild,
                  qty: qtyChild,
                  minQty: 0,
                  stock: tour.stockChild,
                  setQty: setQtyChild,
                },
                {
                  name: "Em bé",
                  label: "Em bé:",
                  oldPrice: tour.priceBaby,
                  unitPrice: unitBaby,
                  qty: qtyBaby,
                  minQty: 0,
                  stock: tour.stockBaby,
                  setQty: setQtyBaby,
                },
              ].map((tier) => {
                const atMin = tier.qty <= tier.minQty;
                const atMax = tier.qty >= tier.stock;
                return (
                <div
                  key={tier.label}
                  className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 text-[13px]"
                >
                  <div className="min-w-[82px]">
                    <span className="font-medium text-ink">
                      {tier.label}
                    </span>
                    <span className="block sm:inline sm:ml-1.5 text-[11px] text-ink-muted tabular-nums">
                      (Còn {tier.stock})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
                    <div className="flex items-center border border-border-strong rounded-[8px] overflow-hidden shrink-0">
                      <button
                        type="button"
                        aria-label={`Giảm số lượng ${tier.name}`}
                        aria-disabled={atMin}
                        onClick={() => {
                          if (atMin) {
                            setQtyHint(
                              tier.minQty > 0
                                ? `Tối thiểu ${tier.minQty} ${tier.name} để đặt tour`
                                : null
                            );
                            return;
                          }
                          setQtyHint(null);
                          tier.setQty(Math.max(tier.minQty, tier.qty - 1));
                        }}
                        className={`w-9 h-9 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center transition-colors ${
                          atMin
                            ? "text-ink-muted opacity-50 cursor-not-allowed bg-surface-page"
                            : "hover:bg-surface-muted text-ink"
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={tier.minQty}
                        max={tier.stock}
                        aria-label={`Số lượng ${tier.name}`}
                        value={tier.qty}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) {
                            tier.setQty(tier.minQty);
                            return;
                          }
                          if (raw > tier.stock) {
                            setQtyHint(
                              `Chỉ còn tối đa ${tier.stock} chỗ cho hạng vé ${tier.name}`
                            );
                            tier.setQty(tier.stock);
                            return;
                          }
                          if (raw < tier.minQty) {
                            setQtyHint(
                              `Tối thiểu ${tier.minQty} ${tier.name} để đặt tour`
                            );
                            tier.setQty(tier.minQty);
                            return;
                          }
                          setQtyHint(null);
                          tier.setQty(Math.floor(raw));
                        }}
                        className="w-9 h-9 sm:w-10 sm:h-9 text-center text-[13px] font-bold text-ink tabular-nums border-x border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-client-primary/30"
                      />
                      <button
                        type="button"
                        aria-label={`Tăng số lượng ${tier.name}`}
                        aria-disabled={atMax}
                        onClick={() => {
                          if (atMax) {
                            setQtyHint(
                              `Chỉ còn tối đa ${tier.stock} chỗ cho hạng vé ${tier.name}`
                            );
                            return;
                          }
                          setQtyHint(null);
                          tier.setQty(Math.min(tier.stock, tier.qty + 1));
                        }}
                        className={`w-9 h-9 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center transition-colors ${
                          atMax
                            ? "text-ink-muted opacity-40 cursor-not-allowed bg-surface-page"
                            : "hover:bg-surface-muted text-ink"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="min-w-[90px] sm:min-w-[104px] text-right font-semibold text-ink tabular-nums shrink-0">
                      {tier.oldPrice > tier.unitPrice && (
                        <div className="text-[11px] font-normal text-ink-muted line-through leading-none mb-0.5 tabular-nums">
                          {tier.oldPrice.toLocaleString("vi-VN")}đ
                        </div>
                      )}
                      <div>
                        {tier.qty} x{" "}
                        <span className="text-client-accent">
                          {tier.unitPrice.toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}

              {qtyHint && (
                <p
                  role="status"
                  className="text-[12px] text-status-warn bg-status-warn-bg border border-status-warn-border rounded-[8px] px-3 py-1.5 font-medium"
                >
                  {qtyHint}
                </p>
              )}
            </div>

            {/* Total Row */}
            <div className="py-3 flex items-center justify-between">
              <span className="text-[15px] font-semibold text-ink">
                Tổng cộng:
              </span>
              <span className="text-[20px] font-extrabold text-client-accent tabular-nums">
                {formatCurrencyVND(totalAmount)}
              </span>
            </div>

            {bookingFeedback && (
              <div
                className={`mb-4 p-3 rounded-[8px] text-[13px] flex flex-col gap-1.5 ${
                  bookingFeedback.type === "success"
                    ? "bg-status-success-bg text-status-success border border-status-success-border"
                    : "bg-status-danger-bg text-status-danger border border-status-danger-border"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {bookingFeedback.type === "success" && (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{bookingFeedback.text}</span>
                </div>
                {bookingFeedback.type === "success" && (
                  <Link
                    href="/cart"
                    className="text-client-primary font-bold underline underline-offset-2 self-start"
                  >
                    Xem Giỏ Hàng &amp; Thanh Toán →
                  </Link>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => addCurrentSelectionToCart(false)}
                className="w-full h-[46px] rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors shadow"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Thêm Vào Giỏ Hàng</span>
              </button>

              <button
                type="button"
                onClick={() => addCurrentSelectionToCart(true)}
                className="w-full h-[42px] rounded-[8px] border border-client-primary text-client-primary hover:bg-client-soft font-semibold text-[14px] transition-colors"
              >
                Đặt Tour Ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tour Reviews & AI Review Summary */}
      <TourReviewsSection
        tourId={tour.id}
        tourSlug={tour.slug}
        tourName={tour.name}
        initialStats={{
          ratingAvg: tour.ratingAvg ?? 5.0,
          reviewCount: tour.reviewCount ?? 0,
          ratingBreakdown,
          aiReviewSummary:
            tour.aiReviewSummary &&
            typeof tour.aiReviewSummary === "object" &&
            "overview" in (tour.aiReviewSummary as Record<string, unknown>)
              ? (tour.aiReviewSummary as TourAiReviewSummary)
              : null,
        }}
        initialReviews={initialReviews}
        onStatsChange={(next) => setLiveRatingStats(next)}
      />

      {/* Related Tours */}
      {relatedTours.length > 0 && (
        <section className="mt-14">
          <h2 className="text-[24px] sm:text-[28px] font-bold text-ink mb-6 text-center">
            Tour Liên Quan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {relatedTours.map((rel) => (
              <TourCard key={rel.id} tour={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
