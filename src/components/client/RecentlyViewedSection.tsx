"use client";

import React, { useEffect, useState } from "react";
import { History } from "lucide-react";
import { TourCard, type TourCardData } from "./TourCard";

const RECENT_TOURS_STORAGE_KEY = "travelvn_recent_tours_v1";
const MAX_RECENT_SLUGS = 6;

export function RecentlyViewedSection({
  currentSlug,
}: {
  currentSlug: string;
}) {
  const [recentTours, setRecentTours] = useState<TourCardData[]>([]);

  useEffect(() => {
    if (!currentSlug) return;
    let cancelled = false;

    let otherSlugs: string[] = [];
    try {
      const raw = window.localStorage.getItem(RECENT_TOURS_STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const cleaned = Array.isArray(existing)
        ? existing.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      const updated = [
        currentSlug,
        ...cleaned.filter((s) => s !== currentSlug),
      ].slice(0, MAX_RECENT_SLUGS);
      window.localStorage.setItem(
        RECENT_TOURS_STORAGE_KEY,
        JSON.stringify(updated)
      );
      otherSlugs = updated.filter((s) => s !== currentSlug).slice(0, 4);
    } catch {
      otherSlugs = [];
    }

    if (otherSlugs.length === 0) {
      setRecentTours([]);
      return;
    }

    async function loadRecentTours() {
      try {
        const res = await fetch(
          `/api/client/tours/suggest?slugs=${encodeURIComponent(otherSlugs.join(","))}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.tours)) {
          setRecentTours(
            (data.tours as TourCardData[])
              .filter((t) => t.slug !== currentSlug)
              .slice(0, 4)
          );
        }
      } catch {
        // Ignore transient network errors
      }
    }

    void loadRecentTours();
    return () => {
      cancelled = true;
    };
  }, [currentSlug]);

  if (recentTours.length === 0) {
    return null;
  }

  return (
    <section className="mt-14" aria-label="Tour đã xem gần đây">
      <div className="flex items-center justify-center gap-2 mb-6">
        <History className="w-6 h-6 text-client-primary" />
        <h2 className="text-[24px] sm:text-[28px] font-bold text-ink text-center">
          Tour Bạn Đã Xem Gần Đây
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {recentTours.map((tour) => (
          <TourCard key={tour.id} tour={tour} />
        ))}
      </div>
    </section>
  );
}
