"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronLeft,
  Compass,
  GitCompare,
  Loader2,
  MapPin,
  Minus,
  RotateCcw,
  Send,
  ShoppingCart,
  Star,
  X,
} from "lucide-react";
import { formatCurrencyVND } from "@/lib/format";
import { SmartImage } from "@/components/client/SmartImage";
import { ChatMarkdown } from "@/components/client/ChatMarkdown";
import { useCart } from "@/components/client/CartContext";
import { useCompare } from "@/components/client/CompareContext";
import type { TourCardData } from "@/components/client/TourCard";
import type { AssistantTourContext } from "@/lib/ai";
import type { AssistantPageContext } from "@/lib/ai-tools";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tours?: AssistantTourContext[];
  source?: "gemini" | "heuristic" | "guardrail";
}

const STORAGE_MESSAGES_KEY = "vntravel_ai_chat_messages_v1";
const STORAGE_OPEN_KEY = "vntravel_ai_chat_open_v1";

const QUICK_PROMPTS = [
  "Gia đình 2 người lớn 1 trẻ em đi biển dưới 15 triệu",
  "Tour biển dưới 5 triệu",
  "Tour khởi hành từ Hà Nội",
  "Tour được đánh giá cao nhất",
];

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào! Mình là Trợ lý Du lịch AI của VN.TRAVEL. Bạn đang muốn tìm tour theo ngân sách, báo giá nhóm gia đình hay so sánh hành trình nào?",
};

function toTourCardData(t: AssistantTourContext): TourCardData {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    slug: t.slug,
    avatar: t.avatar,
    priceAdult: t.priceAdult,
    priceChild: t.priceNewChild ?? 0,
    priceBaby: t.priceNewBaby ?? 0,
    priceNewAdult: t.priceNewAdult,
    priceNewChild: t.priceNewChild ?? 0,
    priceNewBaby: t.priceNewBaby ?? 0,
    stockAdult: t.stockAdult ?? 10,
    stockChild: t.stockChild ?? 5,
    stockBaby: t.stockBaby ?? 5,
    locations: t.locations,
    time: t.time,
    vehicle: t.vehicle,
    departureDate: t.departureDate,
    ratingAvg: t.ratingAvg,
    reviewCount: t.reviewCount,
    durationDays: t.durationDays,
    hotelStar: t.hotelStar,
    singleRoomSurcharge: t.singleRoomSurcharge,
    tags: t.tags,
    departures: t.departures,
    category: t.category ?? null,
  };
}

export function AiTravelAssistant() {
  const pathname = usePathname() || "/";
  const { addItem } = useCart();
  const { addTour, isInCompare } = useCompare();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [compareFullId, setCompareFullId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isCartPage = pathname.startsWith("/cart");
  const shiftFabUp = footerInView || isCartPage;

  const activeTourSlug = useMemo(() => {
    const match = pathname.match(/^\/tours\/([^/?#]+)$/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [pathname]);

  // Observe #footer-newsletter so FAB shifts upward & never overlaps "Đăng Ký Ngay"
  useEffect(() => {
    const footerEl = document.getElementById("footer-newsletter");
    if (!footerEl || typeof IntersectionObserver === "undefined") {
      setFooterInView(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setFooterInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.05 }
    );

    observer.observe(footerEl);
    return () => observer.disconnect();
  }, [pathname]);

  // Restore persisted chat history & open state across route transitions
  useEffect(() => {
    try {
      const savedMessages = window.sessionStorage.getItem(STORAGE_MESSAGES_KEY);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.slice(-20));
        }
      }
      const savedOpen = window.sessionStorage.getItem(STORAGE_OPEN_KEY);
      if (savedOpen === "1") {
        setOpen(true);
      }
    } catch {
      // Ignore sessionStorage errors
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_MESSAGES_KEY,
        JSON.stringify(messages.slice(-20))
      );
    } catch {
      // Ignore quota errors
    }
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_OPEN_KEY, open ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
  }, [open, hydrated]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function buildPageContext(): AssistantPageContext {
    if (activeTourSlug) {
      return {
        pageType: "tour-detail",
        pathname,
        tourSlug: activeTourSlug,
      };
    }
    if (pathname === "/tours") {
      const sp =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      return {
        pageType: "tours-catalog",
        pathname,
        filters: sp
          ? {
              category: sp.get("category") || undefined,
              destination:
                sp.get("destination") || sp.get("keyword") || undefined,
              priceRange: sp.get("priceRange") || undefined,
              dealOnly:
                sp.get("deal") === "true" || sp.get("deal") === "1"
                  ? true
                  : undefined,
            }
          : undefined,
      };
    }
    if (pathname === "/") {
      return { pageType: "home", pathname };
    }
    if (pathname === "/cart") {
      return { pageType: "cart", pathname };
    }
    return { pageType: "other", pathname };
  }

  function resetConversation() {
    setMessages([INITIAL_MESSAGE]);
    try {
      window.sessionStorage.removeItem(STORAGE_MESSAGES_KEY);
    } catch {
      // Ignore
    }
  }

  function handleQuickAddToCart(t: AssistantTourContext) {
    const unitAdult = t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
    const unitChild =
      (t.priceNewChild ?? 0) > 0
        ? t.priceNewChild!
        : Math.round(unitAdult * 0.7);
    const unitBaby = t.priceNewBaby ?? 0;
    const defaultLoc =
      t.nextDepartureLocation ||
      (Array.isArray(t.locations) && t.locations[0]
        ? String(t.locations[0])
        : "Hà Nội");

    const ok = addItem({
      tourId: t.id,
      slug: t.slug,
      code: t.code,
      name: t.name,
      avatar: t.avatar,
      departureDate: t.departureDate ? String(t.departureDate) : null,
      departureLocation: defaultLoc,
      priceNewAdult: unitAdult,
      priceNewChild: unitChild,
      priceNewBaby: unitBaby,
      stockAdult: Math.max(1, t.stockAdult ?? 10),
      stockChild: t.stockChild ?? 5,
      stockBaby: t.stockBaby ?? 5,
      quantityAdult: t.quoteAdults ?? 1,
      quantityChild: t.quoteChildren ?? 0,
      quantityBaby: t.quoteBabies ?? 0,
    });

    if (ok) {
      setAddedIds((prev) => ({ ...prev, [t.id]: true }));
      window.setTimeout(() => {
        setAddedIds((prev) => ({ ...prev, [t.id]: false }));
      }, 2000);
    }
  }

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = nextMessages
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/client/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          pageContext: buildPageContext(),
        }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: res.ok
          ? data.reply
          : data.message || "Xin lỗi, mình chưa thể trả lời lúc này.",
        tours: Array.isArray(data.recommendedTours)
          ? data.recommendedTours
          : undefined,
        source: data.source,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Kết nối mạng đang gián đoạn, bạn thử gửi lại giúp mình nhé!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const positionClass =
    minimized && !open
      ? shiftFabUp
        ? "bottom-24 sm:bottom-28 right-0"
        : "bottom-4 right-0"
      : shiftFabUp
        ? "bottom-24 sm:bottom-28 right-4 sm:right-6"
        : "bottom-4 right-4 sm:bottom-6 sm:right-6";

  return (
    <div
      className={`fixed z-40 font-lexend-deca transition-[bottom] duration-200 ${positionClass}`}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Trợ lý du lịch AI"
          className="fixed bottom-[4.5rem] inset-x-3 sm:static sm:inset-x-auto sm:mb-3 sm:w-[400px] h-[540px] max-h-[75vh] bg-white rounded-[16px] shadow-[0_20px_48px_rgba(22,34,41,0.16)] border border-border-subtle flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-client-primary text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[14px] font-bold leading-tight">
                  Trợ lý AI VN.TRAVEL
                </p>
                <p className="text-[11px] text-white/80">
                  {activeTourSlug
                    ? "Đang đồng bộ ngữ cảnh tour bạn xem"
                    : "Tư vấn tour, báo giá nhóm & chính sách 24/7"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Làm mới cuộc trò chuyện"
                title="Làm mới cuộc trò chuyện"
                onClick={resetConversation}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Đóng Trợ lý AI"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-surface-page"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-client-primary text-white rounded-br-[4px]"
                      : "bg-white text-ink border border-border-subtle rounded-bl-[4px] shadow-sm"
                  }`}
                >
                  <ChatMarkdown
                    content={msg.content}
                    isUser={msg.role === "user"}
                  />
                </div>

                {msg.role === "assistant" &&
                  msg.tours &&
                  msg.tours.length > 0 && (
                    <div className="mt-2 w-full space-y-2">
                      {msg.tours.map((t) => {
                        const displayPrice =
                          t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
                        const isAdded = Boolean(addedIds[t.id]);
                        const compared = isInCompare(t.id);

                        return (
                          <div
                            key={t.id}
                            className="p-2.5 rounded-[10px] bg-white border border-border-subtle hover:border-client-border transition-colors shadow-sm"
                          >
                            <Link
                              href={`/tours/${t.slug}`}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-2.5 group"
                            >
                              <div className="relative w-14 h-12 rounded-[6px] overflow-hidden shrink-0 bg-surface-muted">
                                <SmartImage
                                  src={t.avatar}
                                  alt={t.name}
                                  targetWidth={200}
                                  quality={75}
                                  sizes="64px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-bold text-ink group-hover:text-client-primary truncate transition-colors">
                                  {t.name}
                                </p>
                                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-bold text-client-accent tabular-nums">
                                    {formatCurrencyVND(displayPrice)}/khách
                                  </span>
                                  <span className="text-ink-muted inline-flex items-center gap-0.5 tabular-nums">
                                    <Star className="w-3 h-3 fill-client-star text-client-star" />
                                    {(t.reviewCount ?? 0) > 0
                                      ? (t.ratingAvg ?? 5).toFixed(1)
                                      : "Mới"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-ink-muted truncate inline-flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-2.5 h-2.5 text-client-primary shrink-0" />
                                  <span>{t.time}</span>
                                  {t.nextDepartureLocation && (
                                    <span>· từ {t.nextDepartureLocation}</span>
                                  )}
                                </p>
                              </div>
                            </Link>

                            {t.quoteSummary && (
                              <div className="mt-2 px-2 py-1 rounded-[6px] bg-client-soft border border-client-border text-[11px] font-semibold text-client-primary tabular-nums">
                                {t.quoteSummary}
                              </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-border-subtle flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleQuickAddToCart(t)}
                                className={`flex-1 h-7 px-2.5 rounded-[7px] text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                                  isAdded
                                    ? "bg-status-success text-white"
                                    : "bg-client-primary hover:bg-client-primary-hover text-white"
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Đã thêm!</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart className="w-3 h-3" />
                                    <span>Thêm vào giỏ</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const ok = addTour(toTourCardData(t));
                                  if (!ok) {
                                    setCompareFullId(t.id);
                                    window.setTimeout(() => {
                                      setCompareFullId((cur) =>
                                        cur === t.id ? null : cur
                                      );
                                    }, 2000);
                                  }
                                }}
                                disabled={compared}
                                className={`h-7 px-2.5 rounded-[7px] text-[11px] font-semibold border inline-flex items-center justify-center gap-1 transition-colors ${
                                  compared
                                    ? "bg-client-soft border-client-primary text-client-primary"
                                    : compareFullId === t.id
                                      ? "bg-status-warn-bg border-status-warn-border text-status-warn"
                                      : "bg-white border-border-strong text-ink hover:border-client-primary hover:text-client-primary"
                                }`}
                              >
                                <GitCompare className="w-3 h-3" />
                                <span>
                                  {compared
                                    ? "Đang so sánh"
                                    : compareFullId === t.id
                                      ? "Tối đa 3 tour"
                                      : "So sánh"}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            ))}

            {loading && (
              <div className="inline-flex items-center gap-2 bg-white border border-border-subtle rounded-[12px] px-3.5 py-2 text-[12px] text-ink-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-client-primary" />
                <span>Đang tìm tour phù hợp...</span>
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-white border-t border-border-subtle flex flex-wrap items-center gap-1.5">
            {QUICK_PROMPTS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={loading}
                onClick={() => sendQuestion(chip)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-client-soft hover:bg-client-primary text-client-primary hover:text-white transition-colors text-left"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-2.5 bg-white border-t border-border-subtle flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi AI: Gia đình 2 NL 1 TE đi biển dưới 15tr..."
              maxLength={500}
              className="flex-1 h-9 px-3 rounded-[8px] border border-border-strong text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/40"
            />
            <button
              type="submit"
              aria-label="Gửi câu hỏi"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-[8px] bg-client-primary hover:bg-client-primary-hover disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {minimized && !open ? (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Hiện nút Trợ lý AI"
          title="Mở lại Trợ lý AI VN.TRAVEL"
          className="h-10 pl-2.5 pr-2 rounded-l-full bg-client-primary hover:bg-client-primary-hover text-white shadow-[0_8px_20px_rgba(22,34,41,0.16)] border border-r-0 border-white/25 flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <Compass className="w-4 h-4" />
        </button>
      ) : (
        <div className="relative ml-auto w-fit">
          {!open && (
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label="Thu nhỏ nút Trợ lý AI"
              title="Thu nhỏ sang cạnh phải"
              className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full bg-white text-client-primary border border-client-border shadow-sm hover:bg-client-soft flex items-center justify-center transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMinimized(false);
              setOpen((v) => !v);
            }}
            aria-label={open ? "Thu gọn Trợ lý AI" : "Mở Trợ lý AI VN.TRAVEL"}
            title={open ? "Thu gọn Trợ lý AI" : "Trợ lý AI VN.TRAVEL"}
            className="relative h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-client-primary hover:bg-client-primary-hover text-white shadow-[0_12px_28px_rgba(22,34,41,0.18)] ring-2 ring-white/25 flex items-center justify-center transition-colors"
          >
            {open ? (
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <>
                <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <span className="absolute top-0.5 right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-status-success ring-2 ring-client-primary" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
