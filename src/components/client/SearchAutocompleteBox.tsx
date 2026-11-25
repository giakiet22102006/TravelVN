"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Flame, Loader2, MapPin } from "lucide-react";
import { SmartImage } from "@/components/client/SmartImage";
import type { TourCardData } from "@/components/client/TourCard";
import { formatCurrencyVND } from "@/lib/format";

const DEFAULT_DESTINATIONS = [
  "Hà Nội",
  "SaPa",
  "Phú Quốc",
  "Đà Nẵng",
  "Nhật Bản",
  "Đà Lạt",
  "Hạ Long",
  "Singapore",
];

interface SuggestPayload {
  destinations: string[];
  tours: TourCardData[];
}

interface SearchAutocompleteBoxProps {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
}

export function SearchAutocompleteBox({
  value,
  onChange,
  open,
  onOpenChange,
  placeholder = "Bạn muốn đi đâu?",
}: SearchAutocompleteBoxProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, SuggestPayload>>(new Map());

  const [destinations, setDestinations] = useState<string[]>(
    DEFAULT_DESTINATIONS.slice(0, 6)
  );
  const [tours, setTours] = useState<TourCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Close on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onOpenChange]);

  // 200ms debounced fetch (and instant cache hit / prefetch on focus)
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }

    const q = value.trim();
    const cached = cacheRef.current.get(q);
    if (cached) {
      setDestinations(
        cached.destinations.length > 0
          ? cached.destinations
          : DEFAULT_DESTINATIONS.slice(0, 5)
      );
      setTours(cached.tours);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const delay = q ? 200 : 0;

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/client/tours/suggest?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) throw new Error("Suggest failed");
        const data = (await res.json()) as Partial<SuggestPayload>;
        if (cancelled) return;
        const nextPayload: SuggestPayload = {
          destinations: Array.isArray(data.destinations)
            ? data.destinations
            : [],
          tours: Array.isArray(data.tours) ? data.tours : [],
        };
        cacheRef.current.set(q, nextPayload);
        setDestinations(
          nextPayload.destinations.length > 0
            ? nextPayload.destinations
            : q
            ? []
            : DEFAULT_DESTINATIONS.slice(0, 5)
        );
        setTours(nextPayload.tours);
      } catch {
        if (!cancelled) {
          setDestinations(q ? [] : DEFAULT_DESTINATIONS.slice(0, 5));
          setTours([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, open]);

  const totalOptions = destinations.length + tours.length;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onOpenChange(false);
      setActiveIndex(-1);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") {
        onOpenChange(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (totalOptions > 0) {
        setActiveIndex((prev) => (prev + 1) % totalOptions);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalOptions > 0) {
        setActiveIndex((prev) => (prev <= 0 ? totalOptions - 1 : prev - 1));
      }
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      if (activeIndex < destinations.length) {
        onChange(destinations[activeIndex]);
        onOpenChange(false);
        setActiveIndex(-1);
      } else {
        const chosenTour = tours[activeIndex - destinations.length];
        if (chosenTour) {
          onOpenChange(false);
          setActiveIndex(-1);
          router.push(`/tours/${chosenTour.slug}`);
        }
      }
    }
  }

  const activeDescendantId =
    open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="md:col-span-4 relative">
      <div className="bg-surface-page hover:bg-white border border-border-subtle rounded-[10px] h-[54px] px-3.5 flex items-center gap-2.5 text-ink focus-within:bg-white focus-within:border-client-primary focus-within:ring-2 focus-within:ring-client-primary/20 transition-colors">
        <MapPin className="w-5 h-5 text-client-primary shrink-0" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          aria-label={placeholder}
          value={value}
          onFocus={() => onOpenChange(true)}
          onChange={(e) => {
            onChange(e.target.value);
            onOpenChange(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-[44px] bg-transparent text-[14px] font-medium placeholder:text-ink-muted focus:outline-none rounded"
        />
        {loading && open && (
          <Loader2 className="w-4 h-4 animate-spin text-client-primary shrink-0" />
        )}
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Gợi ý điểm đến và tour"
          className="absolute left-0 top-[62px] w-full sm:w-[440px] bg-white rounded-[12px] shadow-[0_20px_48px_rgba(22,34,41,0.18)] border border-border-subtle p-4 z-30 text-ink max-h-[420px] overflow-y-auto"
        >
          {destinations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink mb-2.5">
                <Flame className="w-4 h-4 text-client-accent" />
                <span>
                  {value.trim() ? "Điểm đến gợi ý" : "Địa điểm nổi bật"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {destinations.map((place, idx) => {
                  const isActive = activeIndex === idx;
                  return (
                    <button
                      key={place}
                      id={`${listboxId}-opt-${idx}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => {
                        onChange(place);
                        onOpenChange(false);
                        setActiveIndex(-1);
                      }}
                      className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-client-primary text-white"
                          : "bg-surface-muted text-ink hover:bg-client-primary hover:text-white"
                      }`}
                    >
                      {place}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tours.length > 0 && (
            <div
              className={
                destinations.length > 0
                  ? "mt-4 pt-3 border-t border-border-subtle"
                  : ""
              }
            >
              <p className="text-[12px] font-semibold text-ink-muted mb-2">
                {value.trim() ? "Tour phù hợp nhất" : "Tour được quan tâm"}
              </p>
              <div className="space-y-1.5">
                {tours.map((t, idx) => {
                  const optIdx = destinations.length + idx;
                  const isActive = activeIndex === optIdx;
                  const displayPrice =
                    t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
                  return (
                    <Link
                      key={t.id}
                      id={`${listboxId}-opt-${optIdx}`}
                      role="option"
                      aria-selected={isActive}
                      href={`/tours/${t.slug}`}
                      onClick={() => {
                        onOpenChange(false);
                        setActiveIndex(-1);
                      }}
                      className={`flex items-center gap-2.5 p-2 rounded-[10px] transition-colors ${
                        isActive
                          ? "bg-client-soft border border-client-border"
                          : "hover:bg-surface-page"
                      }`}
                    >
                      <div className="relative w-12 h-10 rounded-[6px] overflow-hidden shrink-0 bg-surface-muted">
                        <SmartImage
                          src={t.avatar}
                          alt={t.name}
                          targetWidth={200}
                          quality={80}
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink truncate">
                          {t.name}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px]">
                          <span className="text-client-accent font-bold tabular-nums">
                            {formatCurrencyVND(displayPrice)}
                          </span>
                          <span className="text-ink-muted inline-flex items-center gap-1 truncate">
                            <Clock className="w-3 h-3 text-client-primary shrink-0" />
                            <span>{t.time || "Liên hệ"}</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && destinations.length === 0 && tours.length === 0 && (
            <p className="text-[13px] text-ink-muted text-center py-4">
              Chưa tìm thấy tour hoặc điểm đến khớp &ldquo;{value.trim()}&rdquo;.
              Bấm Tìm Kiếm để xem tất cả kết quả.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
