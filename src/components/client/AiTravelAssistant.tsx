"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { formatCurrencyVND } from "@/lib/format";
import { SmartImage } from "@/components/client/SmartImage";
import type { AssistantTourContext } from "@/lib/ai";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tours?: AssistantTourContext[];
  source?: "gemini" | "heuristic";
}

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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

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
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/client/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
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
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 font-lexend-deca">
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
                  Tư vấn lịch trình &amp; giá tour trực tiếp từ DB
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng Trợ lý AI"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
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
                  className={`max-w-[88%] rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-[#4502C7] text-white rounded-br-[4px]"
                      : "bg-white text-[#25282B] border border-[#E8E6F2] rounded-bl-[4px] shadow-xs"
                  }`}
                >
                  {msg.content}
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
        className="ml-auto h-[46px] px-4 rounded-full bg-[#4502C7] hover:bg-[#36019e] text-white font-semibold text-[13px] shadow-[0_10px_28px_rgba(69,2,199,0.36)] inline-flex items-center gap-2 transition-transform hover:scale-[1.03]"
      >
        <Sparkles className="w-4 h-4 text-[#FFE066]" />
        <span>{open ? "Thu gọn Trợ lý AI" : "Trợ lý AI VN.TRAVEL"}</span>
      </button>
    </div>
  );
}
