"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  Star,
  X,
} from "lucide-react";
import { formatCurrencyVND } from "@/lib/format";
import { SmartImage } from "@/components/client/SmartImage";
import { ChatMarkdown } from "@/components/client/ChatMarkdown";
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
  "Tour biển dưới 5 triệu",
  "Tour khởi hành từ Hà Nội",
  "Tour được đánh giá cao nhất",
  "Tour nước ngoài đang giảm giá",
];

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào! Mình là Trợ lý Du lịch AI của VN.TRAVEL. Bạn đang muốn tìm tour theo ngân sách, điểm đến hay ngày khởi hành nào?",
};

export function AiTravelAssistant() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeTourSlug = useMemo(() => {
    const match = pathname.match(/^\/tours\/([^/?#]+)$/);
    return match ? decodeURIComponent(match[1]) : undefined;
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

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-40 font-lexend-deca">
      {open && (
        <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] max-h-[75vh] bg-white rounded-[16px] shadow-[0_18px_48px_rgba(32,12,84,0.22)] border border-[#E2D9F9] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#4502C7] to-[#6B28EB] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[14px] font-bold leading-tight">
                  Trợ lý AI VN.TRAVEL
                </p>
                <p className="text-[11px] text-white/80">
                  {activeTourSlug
                    ? "Đang đồng bộ ngữ cảnh tour bạn xem"
                    : "Tư vấn tour, lịch trình & chính sách 24/7"}
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
            className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F8F7FC]"
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
                      ? "bg-[#4502C7] text-white rounded-br-[4px]"
                      : "bg-white text-[#25282B] border border-[#E8E6F2] rounded-bl-[4px] shadow-xs"
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
                        return (
                          <Link
                            key={t.id}
                            href={`/tours/${t.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 p-2 rounded-[10px] bg-white border border-[#E5E0F6] hover:border-[#4502C7] transition-colors shadow-xs"
                          >
                            <div className="relative w-14 h-12 rounded-[6px] overflow-hidden shrink-0 bg-[#F2F2F2]">
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
                              <p className="text-[12px] font-bold text-[#25282B] truncate">
                                {t.name}
                              </p>
                              <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-bold text-[#DA0808]">
                                  {formatCurrencyVND(displayPrice)}
                                </span>
                                <span className="text-[#667479] inline-flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-[#FFB800] text-[#FFB800]" />
                                  {(t.reviewCount ?? 0) > 0
                                    ? (t.ratingAvg ?? 5).toFixed(1)
                                    : "Mới"}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#667479] truncate inline-flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 text-[#4502C7]" />
                                {t.time}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
              </div>
            ))}

            {loading && (
              <div className="inline-flex items-center gap-2 bg-white border border-[#E8E6F2] rounded-[12px] px-3.5 py-2 text-[12px] text-[#667479]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4502C7]" />
                <span>Đang tìm tour phù hợp...</span>
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-white border-t border-[#ECECEC] flex items-center gap-1.5 overflow-x-auto">
            {QUICK_PROMPTS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={loading}
                onClick={() => sendQuestion(chip)}
                className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F4EEFF] hover:bg-[#4502C7] text-[#4502C7] hover:text-white transition-colors"
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
            className="p-2.5 bg-white border-t border-[#ECECEC] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi AI: Đi Đà Nẵng dưới 5 triệu..."
              maxLength={500}
              className="flex-1 h-9 px-3 rounded-[8px] border border-[#D4D8DD] text-[13px] focus:outline-none focus:border-[#4502C7]"
            />
            <button
              type="submit"
              aria-label="Gửi câu hỏi"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Thu gọn Trợ lý AI" : "Mở Trợ lý AI VN.TRAVEL"}
        title={open ? "Thu gọn Trợ lý AI" : "Trợ lý AI VN.TRAVEL"}
        className="ml-auto relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#4502C7] to-[#6B28EB] hover:from-[#36019e] hover:to-[#591fd0] text-white shadow-[0_12px_30px_rgba(69,2,199,0.42)] ring-2 ring-white/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <svg
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
              aria-hidden="true"
            >
              {/* Antenna */}
              <line
                x1="18"
                y1="4.5"
                x2="18"
                y2="9"
                stroke="#FFE066"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="18" cy="4" r="2.2" fill="#FFE066" />
              {/* Ears */}
              <rect x="4" y="15.5" width="3.5" height="7" rx="1.75" fill="#E9DDFF" />
              <rect x="28.5" y="15.5" width="3.5" height="7" rx="1.75" fill="#E9DDFF" />
              {/* Cute rounded head */}
              <rect x="7" y="9" width="22" height="19" rx="8.5" fill="#FFFFFF" />
              {/* Visor / Face */}
              <rect x="10" y="12.5" width="16" height="11" rx="5.5" fill="#1E103C" />
              {/* Eyes */}
              <circle cx="14.5" cy="17.5" r="1.8" fill="#7DF9FF" />
              <circle cx="21.5" cy="17.5" r="1.8" fill="#7DF9FF" />
              <circle cx="15" cy="17" r="0.6" fill="#FFFFFF" />
              <circle cx="22" cy="17" r="0.6" fill="#FFFFFF" />
              {/* Rosy cheeks */}
              <ellipse cx="12.2" cy="20.2" rx="1.3" ry="0.8" fill="#FF8FAB" fillOpacity="0.85" />
              <ellipse cx="23.8" cy="20.2" rx="1.3" ry="0.8" fill="#FF8FAB" fillOpacity="0.85" />
              {/* Cute smile */}
              <path
                d="M16 20.6C16.7 21.5 19.3 21.5 20 20.6"
                stroke="#FFE066"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-[#4502C7]" />
          </>
        )}
      </button>
    </div>
  );
}
