import React from "react";
import { ClientLayoutShell } from "@/components/client/ClientLayoutShell";
import { HomePageClient } from "@/components/client/HomePageClient";
import { getClientShellData, queryClientTours } from "@/lib/client-data";
import { getCurrentUser } from "@/lib/client-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [shellData, currentUser, dealData, domesticData, internationalData] =
    await Promise.all([
      getClientShellData(),
      getCurrentUser(),
      queryClientTours({ dealOnly: true, sort: "deal", limit: 3 }),
      queryClientTours({ categorySlug: "tour-trong-nuoc", limit: 4 }),
      queryClientTours({ categorySlug: "tour-nuoc-ngoai", limit: 4 }),
    ]);

  return (
    <ClientLayoutShell
      initialCategories={shellData.categories}
      initialCategoryTree={shellData.tree}
      initialWebsiteInfo={shellData.websiteInfo}
      initialUser={currentUser}
    >
      <HomePageClient
        dealTours={dealData.tours}
        domesticTours={domesticData.tours}
        internationalTours={internationalData.tours}
      />
    </ClientLayoutShell>
  );
}
