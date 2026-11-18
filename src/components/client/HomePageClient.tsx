"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  Flame,
  MapPin,
  Minus,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { TourCard, type TourCardData } from "@/components/client/TourCard";
import { SmartImage } from "@/components/client/SmartImage";

const HOT_DESTINATIONS = [
  "Nhật Bản",
  "Singapore",
  "Châu Âu",
  "Đà Lạt",
  "Phú Quốc",
  "Hà Nội",
  "Sapa",
  "Đà Nẵng",
];

const NEWS_ARTICLES = [
  {
    id: "news-main",
    date: "23/05/2024",
    title: "Top 5 điểm check in độc đáo tại Singapore",
    excerpt:
      "Nếu bạn nghĩ du lịch Singapore rất nhàm chán vì chỉ mãi quanh quẩn trong những khối bê tông vô cảm thì bạn “chắc chưa?”. Tuy đảo quốc Sư Tử không phải là một quốc gia rộng lớn nhưng các địa điểm du lịch tại Singapore chưa từng đánh mất sức hút đối với cộng đồng xê dịch quốc tế.",
    image:
      "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=900&q=80",
    featured: true,
    href: "/tours?destination=Singapore",
  },
  {
    id: "news-1",
    date: "23/05/2024",
    title: "Homestay “cổ tích” giữa Đà Lạt mộng mơ",
    excerpt: "",
    image:
      "https://images.unsplash.com/photo-1643799297057-374040b7db1b?auto=format&fit=crop&w=800&q=80",
    featured: false,
    href: "/tours?destination=%C4%90%C3%A0%20L%E1%BA%A1t",
  },
  {
    id: "news-2",
    date: "23/05/2024",
    title: "Đảo Phú Quý Bình Thuận hot trend năm 2024",
    excerpt: "",
    image:
      "https://images.unsplash.com/photo-1692892085515-e5771e7f2948?auto=format&fit=crop&w=800&q=80",
    featured: false,
    href: "/tours?category=tour-mien-nam",
  },
  {
    id: "news-3",
    date: "23/05/2024",
    title: "Đặc sản không thể bỏ qua khi đến với Đà Nẵng – Hội An",
    excerpt: "",
    image:
      "https://images.unsplash.com/photo-1733041449281-9f5c8cd67780?auto=format&fit=crop&w=800&q=80",
    featured: false,
    href: "/tours?category=tour-mien-trung",
  },
  {
    id: "news-4",
    date: "23/05/2024",
    title:
      "Trekking cắm trại tại Đà Lạt- Cảm nhận Đà Lạt qua từng bước chân",
    excerpt: "",
    image:
      "https://images.unsplash.com/photo-1652829792625-055eb9e877a3?auto=format&fit=crop&w=800&q=80",
    featured: false,
    href: "/tours?destination=%C4%90%C3%A0%20L%E1%BA%A1t",
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
}

export function HomePageClient({
  dealTours,
  domesticTours,
  internationalTours,
}: HomePageClientProps) {
  const router = useRouter();

  // Search Bar States
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [babyCount, setBabyCount] = useState(0);
  const [showDestinationPopup, setShowDestinationPopup] = useState(false);
  const [showQuantityPopup, setShowQuantityPopup] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<TourCardData[]>([]);

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
        setShowQuantityPopup(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Live keyword tour suggestions in Hero destination box
  useEffect(() => {
    const term = destination.trim();
    if (!term || !showDestinationPopup) {
      setLiveSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/client/tours?keyword=${encodeURIComponent(term)}&limit=4`
        );
        const data = await res.json();
        setLiveSuggestions(Array.isArray(data.tours) ? data.tours : []);
      } catch {
        setLiveSuggestions([]);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [destination, showDestinationPopup]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination.trim()) params.set("destination", destination.trim());
    if (departureDate) params.set("departureDate", departureDate);
    if (adultCount > 0) params.set("adult", String(adultCount));
    if (childCount > 0) params.set("child", String(childCount));
    if (babyCount > 0) params.set("baby", String(babyCount));
    setShowDestinationPopup(false);
    setShowQuantityPopup(false);
    router.push(`/tours${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <>
      {/* SECTION 1: Hero Banner & Smart Search */}
      <section className="relative bg-[#1E103C] text-white overflow-hidden">
        <SmartImage
          src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=85"
          alt="Khám phá du lịch toàn cầu cùng VN.TRAVEL"
          targetWidth={1600}
          quality={85}
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-[#1E103C]/85" />

        <div className="relative max-w-[1184px] mx-auto px-4 py-14 sm:py-20 lg:py-24">
          <div className="max-w-[920px] mx-auto text-center">
            <h1 className="text-[24px] sm:text-[34px] lg:text-[40px] font-bold leading-tight tracking-tight drop-shadow-sm">
              <span className="lg:whitespace-nowrap">
                Du lịch Châu Á - Khám phá Mỹ, Úc, Âu
              </span>
              <br />
              <span className="text-[#FFD600]">Đi nơi đâu bạn muốn</span>
            </h1>
            <p className="mt-4 text-[14px] sm:text-[16px] text-white/90 max-w-[640px] mx-auto leading-relaxed">
              Trải nghiệm hành trình trọn gói chuẩn 5 sao cùng VN.TRAVEL — lịch
              khởi hành linh hoạt mỗi ngày với hàng trăm ưu đãi giờ chót hấp
              dẫn.
            </p>
          </div>

          {/* Search Card */}
          <div
            ref={searchWrapperRef}
            className="mt-8 sm:mt-10 max-w-[980px] mx-auto bg-black/55 backdrop-blur-md rounded-[14px] p-4 sm:p-5 border border-white/15 shadow-2xl"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch"
            >
              {/* Input 1: Bạn muốn đi đâu? */}
              <div className="md:col-span-4 relative">
                <div className="bg-white rounded-[10px] h-[54px] px-3.5 flex items-center gap-2.5 text-[#25282B]">
                  <MapPin className="w-5 h-5 text-[#4502C7] shrink-0" />
                  <input
                    type="text"
                    value={destination}
                    onFocus={() => {
                      setShowDestinationPopup(true);
                      setShowQuantityPopup(false);
                    }}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setShowDestinationPopup(true);
                    }}
                    placeholder="Bạn muốn đi đâu?"
                    aria-label="Bạn muốn đi đâu"
                    className="w-full bg-transparent text-[14px] font-medium placeholder:text-[#667479] focus:outline-none"
                  />
                </div>

                {showDestinationPopup && (
                  <div className="absolute left-0 top-[62px] w-full sm:w-[420px] bg-white rounded-[12px] shadow-2xl border border-[#ECECEC] p-4 z-30 text-[#25282B]">
                    <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#4502C7] mb-3">
                      <Flame className="w-4 h-4 text-[#DA0808]" />
                      <span>Địa Điểm Hot</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {HOT_DESTINATIONS.map((place) => (
                        <button
                          key={place}
                          type="button"
                          onClick={() => {
                            setDestination(place);
                            setShowDestinationPopup(false);
                          }}
                          className="text-left px-3 py-2 rounded-[8px] bg-[#F6F6F6] hover:bg-[#4502C7] hover:text-white text-[13px] font-medium transition-colors"
                        >
                          {place}
                        </button>
                      ))}
                    </div>

                    {liveSuggestions.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#ECECEC]">
                        <p className="text-[12px] font-semibold text-[#667479] mb-2">
                          Gợi ý tour phù hợp
                        </p>
                        <div className="space-y-2">
                          {liveSuggestions.map((t) => (
                            <Link
                              key={t.id}
                              href={`/tours/${t.slug}`}
                              onClick={() => setShowDestinationPopup(false)}
                              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#F6F6F6] transition-colors"
                            >
                              <div className="relative w-10 h-10 rounded overflow-hidden shrink-0 bg-[#F6F6F6]">
                                <SmartImage
                                  src={t.avatar}
                                  alt={t.name}
                                  targetWidth={200}
                                  quality={85}
                                  sizes="40px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold truncate">
                                  {t.name}
                                </p>
                                <p className="text-[12px] text-[#DA0808] font-bold">
                                  {t.priceNewAdult.toLocaleString("vi-VN")}đ
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input 2: Ngày khởi hành */}
              <div className="md:col-span-3">
                <div className="bg-white rounded-[10px] h-[54px] px-3.5 flex items-center gap-2.5 text-[#25282B]">
                  <Calendar className="w-5 h-5 text-[#4502C7] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-[10px] text-[#667479] leading-none mb-0.5">
                      Lịch khởi hành
                    </span>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      aria-label="Ngày khởi hành"
                      className="w-full bg-transparent text-[13px] font-medium focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Input 3: Số lượng */}
              <div className="md:col-span-3 relative">
                <button
                  type="button"
                  aria-label="Chọn số lượng hành khách"
                  onClick={() => {
                    setShowQuantityPopup((v) => !v);
                    setShowDestinationPopup(false);
                  }}
                  className="w-full bg-white rounded-[10px] h-[54px] px-3 flex items-center justify-between gap-2 text-[#25282B] text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-5 h-5 text-[#4502C7] shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[10px] text-[#667479] leading-none mb-0.5">
                        Số lượng
                      </span>
                      <span className="block text-[13px] font-medium whitespace-nowrap">
                        {adultCount + childCount + babyCount} Khách
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[#667479] shrink-0" />
                </button>

                {showQuantityPopup && (
                  <div className="absolute right-0 top-[62px] w-[260px] bg-white rounded-[12px] shadow-2xl border border-[#ECECEC] p-4 z-30 text-[#25282B] space-y-3">
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
                          <div className="text-[11px] text-[#667479]">
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
                            className="w-7 h-7 rounded border border-[#CCD1D2] flex items-center justify-center hover:border-[#4502C7] hover:text-[#4502C7]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center text-[13px] font-bold">
                            {row.val}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tăng ${row.label}`}
                            onClick={() => row.setVal(row.val + 1)}
                            className="w-7 h-7 rounded border border-[#CCD1D2] flex items-center justify-center hover:border-[#4502C7] hover:text-[#4502C7]"
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
                  className="w-full h-[54px] rounded-[10px] bg-[#4502C7] hover:bg-[#36019e] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <Search className="w-4 h-4" />
                  <span>Tìm Kiếm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* SECTION 2: Last-Minute Deal Box (#4502C7) */}
      <section className="max-w-[1184px] mx-auto px-4 mt-10">
        <div className="bg-[#4502C7] rounded-[16px] p-5 sm:p-8 shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-3 text-white text-center lg:text-left">
              <p className="text-[18px] sm:text-[22px] font-extrabold uppercase tracking-wide text-[#FFD600]">
                ƯU ĐÃI 2024
              </p>
              <h2 className="text-[26px] sm:text-[30px] font-extrabold uppercase leading-tight mt-1">
                TOUR GIỜ CHÓT
              </h2>
              <p className="mt-2.5 text-[13px] text-white/85 leading-relaxed">
                Săn ngay deal hot giảm sốc mỗi ngày với số lượng chỗ ưu đãi có
                hạn.
              </p>

              <p className="mt-5 text-[13px] font-semibold uppercase tracking-wider text-white/90">
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
                    className="bg-white text-[#4502C7] rounded-[10px] w-[54px] py-2 text-center shadow"
                  >
                    <div className="text-[20px] font-extrabold leading-none">
                      {box.val}
                    </div>
                    <div className="text-[10px] font-semibold text-[#667479] mt-1">
                      {box.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <span className="block text-[12px] font-semibold uppercase tracking-widest text-white/80">
                  GIẢM ĐẾN
                </span>
                <span className="text-[26px] font-extrabold text-[#FFD600]">
                  990.000đ+
                </span>
              </div>
            </div>

            <div className="lg:col-span-9">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-[#4502C7] mb-7">
          Khuyến Mại Bùng Nổ - Đánh Tan Nóng Bức
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: "Siêu Sale Mùa Hè",
              sub: "Giảm tới 400.000đ với mã TOURMUAHE2024",
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
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#DA0808] text-[10px] font-bold tracking-wider mb-1.5">
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
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-[#4502C7] mb-7">
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
            className="inline-flex items-center justify-center px-7 py-2.5 rounded-[8px] border border-[#4502C7] text-[#4502C7] hover:bg-[#4502C7] hover:text-white font-semibold text-[15px] transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
      </section>

      {/* Mid Banner */}
      <section className="max-w-[1184px] mx-auto px-4 mt-14">
        <Link
          href="/tours"
          className="relative block h-[180px] sm:h-[220px] rounded-[16px] overflow-hidden shadow-md group"
        >
          <SmartImage
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1280&q=82"
            alt="Khám phá hành trình mới"
            targetWidth={1280}
            quality={82}
            sizes="100vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#4502C7]/85 via-[#4502C7]/45 to-transparent flex items-center p-6 sm:p-10">
            <div className="max-w-[520px] text-white">
              <p className="text-[12px] uppercase tracking-widest font-bold text-[#FFD600]">
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
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-[#4502C7] mb-7">
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
            className="inline-flex items-center justify-center px-7 py-2.5 rounded-[8px] border border-[#4502C7] text-[#4502C7] hover:bg-[#4502C7] hover:text-white font-semibold text-[15px] transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
      </section>

      {/* SECTION 6: Tin Tức Mới */}
      <section id="news-section" className="max-w-[1184px] mx-auto px-4 mt-14">
        <h2 className="text-center text-[24px] sm:text-[32px] font-bold text-[#4502C7] mb-7">
          Tin Tức Mới
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Featured Center/Left Large Article */}
          {NEWS_ARTICLES.filter((a) => a.featured).map((article) => (
            <Link
              key={article.id}
              href={article.href}
              className="lg:col-span-5 group bg-white rounded-[16px] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#ECECEC] flex flex-col"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <SmartImage
                  src={article.image}
                  alt={article.title}
                  targetWidth={900}
                  quality={82}
                  sizes="(max-width: 1024px) 100vw, 480px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <span className="text-[12px] text-[#667479] font-medium">
                  {article.date}
                </span>
                <h3 className="mt-1.5 text-[18px] sm:text-[20px] font-bold text-[#4502C7] group-hover:underline leading-snug">
                  {article.title}
                </h3>
                <p className="mt-2.5 text-[13px] text-[#667479] leading-relaxed line-clamp-4">
                  {article.excerpt}
                </p>
              </div>
            </Link>
          ))}

          {/* 4 Small Articles Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {NEWS_ARTICLES.filter((a) => !a.featured).map((article) => (
              <Link
                key={article.id}
                href={article.href}
                className="group relative h-[210px] sm:h-[225px] rounded-[16px] overflow-hidden shadow-md block"
              >
                <SmartImage
                  src={article.image}
                  alt={article.title}
                  targetWidth={760}
                  quality={82}
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-4 text-white">
                  <span className="text-[11px] text-white/80">
                    {article.date}
                  </span>
                  <h3 className="mt-1 text-[14px] sm:text-[15px] font-bold leading-snug line-clamp-2 group-hover:text-[#FFD600] transition-colors">
                    {article.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
