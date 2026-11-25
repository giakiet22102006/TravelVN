"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronDown,
  Headphones,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { TourCard, type TourCardData } from "@/components/client/TourCard";
import { SmartImage } from "@/components/client/SmartImage";
import { DatePickerInput } from "@/components/client/DatePickerInput";
import { SearchAutocompleteBox } from "@/components/client/SearchAutocompleteBox";
import type { ClientNewsItem } from "@/lib/client-data";
import { formatDateVN } from "@/lib/format";

const NEWS_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=900&q=80";

const TRUST_COMMITMENTS = [
  {
    title: "Giá trọn gói minh bạch",
    desc: "Niêm yết rõ từng hạng khách, cam kết không phụ phí ẩn.",
    icon: BadgeCheck,
  },
  {
    title: "Bảo hiểm du lịch 1 tỷ đồng",
    desc: "Bảo vệ toàn diện suốt hành trình trong nước & quốc tế.",
    icon: ShieldCheck,
  },
  {
    title: "Hoàn hủy linh hoạt",
    desc: "Chính sách đổi ngày, hoàn tiền rõ ràng theo từng mốc.",
    icon: RefreshCw,
  },
  {
    title: "Tư vấn & AI 24/7",
    desc: "Báo giá nhóm tức thì, hỗ trợ đặt tour mọi lúc mọi nơi.",
    icon: Headphones,
  },
];

interface CountdownState {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

interface HomePageClientProps {
  dealTours: TourCardData[];
  domesticTours: TourCardData[];
  internationalTours: TourCardData[];
  hotNews: ClientNewsItem[];
}

export function HomePageClient({
  dealTours,
  domesticTours,
  internationalTours,
  hotNews,
}: HomePageClientProps) {
  const router = useRouter();

  // Search Bar States
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [babyCount, setBabyCount] = useState(0);
  const [showDestinationPopup, setShowDestinationPopup] = useState(false);
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [showQuantityPopup, setShowQuantityPopup] = useState(false);

  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Countdown Timer (10 days flash window ticking live in browser)
  const [countdown, setCountdown] = useState<CountdownState>({
    days: "10",
    hours: "12",
    minutes: "20",
    seconds: "30",
  });

  useEffect(() => {
    const targetMs = Date.now() + 10 * 24 * 60 * 60 * 1000 + 12 * 3600 * 1000;
    const tick = () => {
      const diff = Math.max(0, targetMs - Date.now());
      const days = Math.floor(diff / (24 * 3600 * 1000));
      const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
      const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);
      setCountdown({
        days: String(days).padStart(2, "0"),
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Click-outside closes search popovers cleanly
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target as Node)
      ) {
        setShowDestinationPopup(false);
        setShowDatePopup(false);
        setShowQuantityPopup(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination.trim()) params.set("destination", destination.trim());
    if (departureDate) params.set("departureDate", departureDate);
    if (adultCount > 0) params.set("adult", String(adultCount));
    if (childCount > 0) params.set("child", String(childCount));
    if (babyCount > 0) params.set("baby", String(babyCount));
    setShowDestinationPopup(false);
    setShowDatePopup(false);
    setShowQuantityPopup(false);
    router.push(`/tours${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <>
      {/* SECTION 1: Hero Banner & Smart Search */}
      <section className="relative z-20 bg-client-deep text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <SmartImage
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=85"
            alt="Khám phá du lịch toàn cầu cùng VN.TRAVEL"
            targetWidth={1600}
            quality={85}
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/45" />
        </div>

        <div className="relative max-w-[1184px] mx-auto px-4 py-14 sm:py-20 lg:py-24">
          <div className="max-w-[920px] mx-auto text-center">
            <h1 className="text-[24px] sm:text-[34px] lg:text-[40px] font-bold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
              <span className="lg:whitespace-nowrap">
                Du lịch Châu Á - Khám phá Mỹ, Úc, Âu
              </span>
              <br />
              <span className="text-client-sun">Đi nơi đâu bạn muốn</span>
            </h1>
            <p className="mt-4 text-[14px] sm:text-[16px] text-white/95 font-medium drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] max-w-[640px] mx-auto leading-relaxed">
              Trải nghiệm hành trình trọn gói chuẩn 5 sao cùng VN.TRAVEL — lịch
              khởi hành linh hoạt mỗi ngày với hàng trăm ưu đãi giờ chót hấp
              dẫn.
            </p>
          </div>

          {/* Search Card (Sunlit Frosted Linen) */}
          <div
            ref={searchWrapperRef}
            className="mt-8 sm:mt-10 max-w-[980px] mx-auto bg-white/95 backdrop-blur-md rounded-[16px] p-3 sm:p-4 border border-white/80 shadow-[0_18px_44px_rgba(22,34,41,0.18)]"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch"
            >
              {/* Input 1: Bạn muốn đi đâu? (Accessible Autocomplete Combobox) */}
              <SearchAutocompleteBox
                value={destination}
                onChange={setDestination}
                open={showDestinationPopup}
                onOpenChange={(nextOpen) => {
                  setShowDestinationPopup(nextOpen);
                  if (nextOpen) {
                    setShowDatePopup(false);
                    setShowQuantityPopup(false);
                  }
                }}
              />

              {/* Input 2: Ngày khởi hành */}
              <DatePickerInput
                value={departureDate}
                onChange={setDepartureDate}
                open={showDatePopup}
                onOpenChange={(nextOpen) => {
                  setShowDatePopup(nextOpen);
                  if (nextOpen) {
                    setShowDestinationPopup(false);
                    setShowQuantityPopup(false);
                  }
                }}
              />

              {/* Input 3: Số lượng */}
              <div className="md:col-span-3 relative">
                <button
                  type="button"
                  aria-label="Chọn số lượng hành khách"
                  onClick={() => {
                    setShowQuantityPopup((v) => !v);
                    setShowDestinationPopup(false);
                    setShowDatePopup(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowQuantityPopup(false);
                  }}
                  className="w-full bg-surface-page hover:bg-white border border-border-subtle rounded-[10px] h-[54px] px-3 flex items-center justify-between gap-2 text-ink text-left focus:outline-none focus:bg-white focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-5 h-5 text-client-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[10px] text-ink-muted leading-none mb-0.5">
                        Số lượng
                      </span>
                      <span className="block text-[13px] font-medium whitespace-nowrap tabular-nums">
                        {adultCount + childCount + babyCount} Khách
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
                </button>

                {showQuantityPopup && (
                  <div className="absolute right-0 top-[62px] w-[260px] bg-white rounded-[12px] shadow-[0_20px_48px_rgba(22,34,41,0.18)] border border-border-subtle p-4 z-30 text-ink space-y-3">
                    {[
                      {
                        label: "Người lớn",
                        sub: "Từ 12 tuổi trở lên",
                        val: adultCount,
                        min: 1,
                        setVal: setAdultCount,
                      },
                      {
                        label: "Trẻ em",
                        sub: "Từ 5 - 11 tuổi",
                        val: childCount,
                        min: 0,
                        setVal: setChildCount,
                      },
                      {
                        label: "Em bé",
                        sub: "Dưới 5 tuổi",
                        val: babyCount,
                        min: 0,
                        setVal: setBabyCount,
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-[13px] font-semibold">
                            {row.label}
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {row.sub}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Giảm ${row.label}`}
                            onClick={() =>
                              row.setVal(Math.max(row.min, row.val - 1))
                            }
                            className="w-7 h-7 rounded border border-border-strong flex items-center justify-center hover:border-client-primary hover:text-client-primary transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center text-[13px] font-bold tabular-nums">
                            {row.val}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tăng ${row.label}`}
                            onClick={() => row.setVal(row.val + 1)}
                            className="w-7 h-7 rounded border border-border-strong flex items-center justify-center hover:border-client-primary hover:text-client-primary transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Submit */}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full h-[54px] rounded-[10px] bg-client-primary hover:bg-client-primary-hover text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Tìm Kiếm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* TRUST VALUE STRIP: 4 Cam kết Vàng VN.TRAVEL */}
      <section className="max-w-[1184px] mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {TRUST_COMMITMENTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white rounded-[14px] border border-border-subtle p-4 flex items-start gap-3 shadow-[0_2px_10px_rgba(22,34,41,0.05)]"
              >
                <div className="w-10 h-10 rounded-[10px] bg-client-soft border border-client-border text-client-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-bold text-ink leading-snug">
                    {item.title}
                  </h2>
                  <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Last-Minute Deal Box (Misty Sage Woodland Surface) */}
      <section className="max-w-[1184px] mx-auto px-4 mt-8 sm:mt-10">
        <div className="bg-client-soft border border-client-border rounded-[20px] p-5 sm:p-8 shadow-[0_4px_20px_rgba(22,34,41,0.04)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-3 text-ink text-center lg:text-left">
              <span className="inline-block px-3 py-1 rounded-full bg-client-primary/10 text-client-primary text-[12px] font-bold tracking-wide">
                Ưu đãi 2026
              </span>
              <h2 className="text-[26px] sm:text-[30px] font-extrabold leading-tight mt-2.5 text-ink">
                Tour Giờ Chót
              </h2>
              <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">
                Săn ngay hành trình giá tốt mỗi ngày với số lượng chỗ ưu đãi có
                hạn.
              </p>

              <p className="mt-5 text-[12px] font-semibold text-ink-muted">
                Kết thúc sau
              </p>
              <div className="mt-2 flex items-center justify-center lg:justify-start gap-2">
                {[
                  { label: "Ngày", val: countdown.days },
                  { label: "Giờ", val: countdown.hours },
                  { label: "Phút", val: countdown.minutes },
                  { label: "Giây", val: countdown.seconds },
                ].map((box) => (
                  <div
                    key={box.label}
                    className="bg-white border border-client-border text-client-primary rounded-[10px] w-[54px] py-2 text-center shadow-sm tabular-nums"
                  >
                    <div className="text-[20px] font-extrabold leading-none tabular-nums">
                      {box.val}
                    </div>
                    <div className="text-[10px] font-semibold text-ink-muted mt-1">
                      {box.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <span className="block text-[12px] font-medium text-ink-muted">
                  Tiết kiệm đến
                </span>
                <span className="text-[26px] font-extrabold text-client-accent tabular-nums">
                  990.000đ+
                </span>
              </div>
            </div>

            <div className="lg:col-span-9">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {dealTours.map((tour) => (
                  <TourCard key={tour.id} tour={tour} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Khuyến Mại Bùng Nổ - Đánh Tan Nóng Bức */}
      <section className="max-w-[1184px] mx-auto px-4 mt-14">
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-ink mb-7">
          Khuyến Mại Bùng Nổ - Đánh Tan Nóng Bức
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: "Siêu Sale Mùa Hè",
              sub: "Giảm tới 400.000đ với mã TOUR2026",
              badge: "HOT DEAL",
              img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=90",
              href: "/tours?deal=true",
            },
            {
              title: "Khám Phá Việt Nam",
              sub: "Hành trình Di sản Miền Bắc - Trung - Nam",
              badge: "TRONG NƯỚC",
              img: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=90",
              href: "/tours?category=tour-trong-nuoc",
            },
            {
              title: "Vi Vu Năm Châu",
              sub: "Nhật Bản - Singapore - Châu Âu bay thẳng",
              badge: "NƯỚC NGOÀI",
              img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=90",
              href: "/tours?category=tour-nuoc-ngoai",
            },
          ].map((banner) => (
            <Link
              key={banner.title}
              href={banner.href}
              className="group relative h-[200px] sm:h-[220px] rounded-[14px] overflow-hidden shadow-md block"
            >
              <SmartImage
                src={banner.img}
                alt={banner.title}
                targetWidth={800}
                quality={82}
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-client-accent text-white text-[10px] font-bold tracking-wider mb-1.5">
                  {banner.badge}
                </span>
                <h3 className="text-[18px] font-bold">{banner.title}</h3>
                <p className="text-[12px] text-white/85 mt-0.5">{banner.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 4: Tour Trong Nước */}
      <section className="max-w-[1184px] mx-auto px-4 mt-14">
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-ink mb-7">
          Tour Trong Nước
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {domesticTours.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/tours?category=tour-trong-nuoc"
            className="inline-flex items-center justify-center px-7 py-2.5 rounded-[8px] border border-client-primary text-client-primary hover:bg-client-primary hover:text-white font-semibold text-[15px] transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
      </section>

      {/* Mid Banner */}
      <section className="max-w-[1184px] mx-auto px-4 mt-14">
        <Link
          href="/tours"
          prefetch={false}
          className="relative block h-[180px] sm:h-[220px] rounded-[16px] overflow-hidden shadow-md group bg-client-deep"
        >
          <SmartImage
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1280&q=82"
            alt="Khám phá hành trình mới"
            targetWidth={1280}
            quality={82}
            sizes="100vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-client-deep/90 via-client-deep/55 to-transparent flex items-center p-6 sm:p-10">
            <div className="max-w-[520px] text-white">
              <p className="text-[12px] uppercase tracking-widest font-bold text-client-sun">
                VN.TRAVEL EXCLUSIVE
              </p>
              <h3 className="text-[22px] sm:text-[28px] font-bold mt-1 leading-snug">
                Đặt Tour Hôm Nay — Giữ Trọn Ưu Đãi Vé Máy Bay & Resort 5 Sao
              </h3>
            </div>
          </div>
        </Link>
      </section>

      {/* SECTION 5: Tour Nước Ngoài */}
      <section className="max-w-[1184px] mx-auto px-4 mt-14">
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-ink mb-7">
          Tour Nước Ngoài
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {internationalTours.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/tours?category=tour-nuoc-ngoai"
            className="inline-flex items-center justify-center px-7 py-2.5 rounded-[8px] border border-client-primary text-client-primary hover:bg-client-primary hover:text-white font-semibold text-[15px] transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
      </section>

      {/* SECTION 6: Tin Tức Mới */}
      {hotNews.length > 0 && (() => {
        const featuredArticle =
          hotNews.find((a) => a.featured) || hotNews[0];
        const sideArticles = hotNews
          .filter((a) => a.id !== featuredArticle.id)
          .slice(0, 4);
        return (
          <section
            id="news-section"
            className="max-w-[1184px] mx-auto px-4 mt-14"
          >
            <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-ink mb-7">
              Tin Tức Mới
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Featured Center/Left Large Article */}
              <Link
                key={featuredArticle.id}
                href={`/news/${featuredArticle.slug}`}
                className="lg:col-span-5 group bg-white rounded-[16px] overflow-hidden shadow-[0_2px_10px_rgba(22,34,41,0.06)] hover:shadow-[0_10px_24px_rgba(22,34,41,0.11)] border border-border-subtle hover:border-client-border transition-[border-color,box-shadow] duration-200 flex flex-col"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-muted">
                  <SmartImage
                    src={featuredArticle.avatar || NEWS_FALLBACK_IMAGE}
                    alt={featuredArticle.title}
                    targetWidth={900}
                    quality={82}
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-client-primary text-white text-[11px] font-bold shadow-sm">
                    {featuredArticle.category}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <span className="text-[12px] text-ink-muted font-medium tabular-nums">
                    {formatDateVN(featuredArticle.publishedAt)}
                  </span>
                  <h3 className="mt-1.5 text-[18px] sm:text-[20px] font-bold text-ink group-hover:text-client-primary transition-colors leading-snug">
                    {featuredArticle.title}
                  </h3>
                  <p className="mt-2.5 text-[13px] text-ink-muted leading-relaxed line-clamp-4">
                    {featuredArticle.excerpt}
                  </p>
                </div>
              </Link>

              {/* 4 Small Articles Grid */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {sideArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/news/${article.slug}`}
                    className="group relative h-[210px] sm:h-[225px] rounded-[16px] overflow-hidden shadow-md block bg-client-deep"
                  >
                    <SmartImage
                      src={article.avatar || NEWS_FALLBACK_IMAGE}
                      alt={article.title}
                      targetWidth={760}
                      quality={82}
                      sizes="(max-width: 640px) 100vw, 360px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col justify-end p-4 text-white">
                      <span className="text-[11px] text-white/90 tabular-nums">
                        {formatDateVN(article.publishedAt)} · {article.category}
                      </span>
                      <h3 className="mt-1 text-[14px] sm:text-[15px] font-bold leading-snug line-clamp-2 group-hover:text-client-sun transition-colors">
                        {article.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/news"
                className="inline-flex items-center justify-center px-7 py-2.5 min-h-[44px] rounded-[8px] border border-client-primary text-client-primary hover:bg-client-primary hover:text-white font-semibold text-[15px] transition-colors"
              >
                Xem tất cả tin tức
              </Link>
            </div>
          </section>
        );
      })()}
    </>
  );
}
