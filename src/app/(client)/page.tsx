import React from "react";
import { HomePageClient } from "@/components/client/HomePageClient";
import { getHomeHotNews, queryClientTours } from "@/lib/client-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [dealData, domesticData, internationalData, hotNews] =
    await Promise.all([
      queryClientTours({ dealOnly: true, sort: "deal", limit: 3 }),
      queryClientTours({ categorySlug: "tour-trong-nuoc", limit: 4 }),
      queryClientTours({ categorySlug: "tour-nuoc-ngoai", limit: 4 }),
      getHomeHotNews(),
    ]);

  return (
    <HomePageClient
      dealTours={dealData.tours}
      domesticTours={domesticData.tours}
      internationalTours={internationalData.tours}
      hotNews={hotNews}
    />
  );
}
