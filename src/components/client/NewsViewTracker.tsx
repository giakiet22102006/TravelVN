"use client";

import { useEffect } from "react";

export function NewsViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `travelvn_viewed_news_${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Ignore sessionStorage restrictions
    }

    fetch(`/api/client/news/${encodeURIComponent(slug)}`, {
      method: "POST",
    }).catch(() => {});
  }, [slug]);

  return null;
}
