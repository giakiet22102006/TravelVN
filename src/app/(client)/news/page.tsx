import React, { Suspense } from "react";
import type { Metadata } from "next";
import { queryClientNews } from "@/lib/client-data";
import { NewsListClient } from "@/components/client/NewsListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin Tức & Cẩm Nang Du Lịch | VN.TRAVEL",
  description:
    "Khám phá tin tức du lịch mới nhất, kinh nghiệm săn tour giá tốt, lịch trình chi tiết và gợi ý điểm đến hấp dẫn cùng VN.TRAVEL.",
};

function firstParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return (raw[0] || "").trim();
  return (raw || "").trim();
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = firstParam(sp.category);
  const keyword = firstParam(sp.keyword);
  const pageRaw = Number(firstParam(sp.page) || 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const apiParams = new URLSearchParams();
  if (category) apiParams.set("category", category);
  if (keyword) apiParams.set("keyword", keyword);
  apiParams.set("page", String(page));
  apiParams.set("limit", "7");

  const initialResult = await queryClientNews({
    category: category || undefined,
    keyword: keyword || undefined,
    page,
    limit: 7,
  });

  return (
    <Suspense
      fallback={
        <div className="max-w-[1184px] mx-auto px-4 py-12">
          <div className="h-[360px] rounded-[16px] bg-white animate-pulse" />
        </div>
      }
    >
      <NewsListClient
        initialResult={initialResult}
        initialQueryKey={apiParams.toString()}
      />
    </Suspense>
  );
}
