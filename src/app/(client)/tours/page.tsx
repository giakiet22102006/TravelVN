import React, { Suspense } from "react";
import { queryClientTours } from "@/lib/client-data";
import { ToursCatalogClient } from "@/components/client/ToursCatalogClient";

export const dynamic = "force-dynamic";

function firstParam(
  raw: string | string[] | undefined
): string {
  if (Array.isArray(raw)) return (raw[0] || "").trim();
  return (raw || "").trim();
}

function parsePositiveInt(val: string, fallback = 0): number {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = firstParam(sp.category);
  const destination = firstParam(sp.destination) || firstParam(sp.keyword);
  const departureLocation = firstParam(sp.departureLocation);
  const departureDate = firstParam(sp.departureDate);
  const adult = parsePositiveInt(firstParam(sp.adult), 0);
  const child = parsePositiveInt(firstParam(sp.child), 0);
  const baby = parsePositiveInt(firstParam(sp.baby), 0);
  const priceRange = firstParam(sp.priceRange);
  const dealRaw = firstParam(sp.deal).toLowerCase();
  const dealOnly = dealRaw === "true" || dealRaw === "1";
  const sort = firstParam(sp.sort);
  const page = Math.max(1, parsePositiveInt(firstParam(sp.page), 1));

  const apiParams = new URLSearchParams();
  if (category) apiParams.set("category", category);
  if (destination) apiParams.set("destination", destination);
  if (departureLocation) apiParams.set("departureLocation", departureLocation);
  if (departureDate) apiParams.set("departureDate", departureDate);
  if (adult > 0) apiParams.set("adult", String(adult));
  if (child > 0) apiParams.set("child", String(child));
  if (baby > 0) apiParams.set("baby", String(baby));
  if (priceRange) apiParams.set("priceRange", priceRange);
  if (dealOnly) apiParams.set("deal", "true");
  if (sort) apiParams.set("sort", sort);
  apiParams.set("page", String(page));
  apiParams.set("limit", "9");

  const initialResult = await queryClientTours({
    categorySlug: category || undefined,
    destination: destination || undefined,
    departureLocation: departureLocation || undefined,
    departureDate: departureDate || undefined,
    adult,
    child,
    baby,
    priceRange: priceRange || undefined,
    dealOnly,
    sort: sort || undefined,
    page,
    limit: 9,
  });

  return (
    <Suspense
      fallback={
        <div className="max-w-[1184px] mx-auto px-4 py-12">
          <div className="h-[220px] rounded-[12px] bg-white border border-border-subtle animate-pulse mb-6" />
        </div>
      }
    >
      <ToursCatalogClient
        initialResult={initialResult}
        initialQueryKey={apiParams.toString()}
      />
    </Suspense>
  );
}
