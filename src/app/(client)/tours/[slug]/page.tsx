import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientTourBySlug } from "@/lib/client-data";
import { TourDetailClient } from "@/components/client/TourDetailClient";

export const dynamic = "force-dynamic";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://travel-vn-kappa.vercel.app"
).replace(/\/$/, "");

function buildSeoDescription(raw: string | null | undefined, fallback: string): string {
  const cleaned = (raw || fallback).replace(/\s+/g, " ").trim();
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getClientTourBySlug(slug);
  if (!data) {
    return {
      title: "Không tìm thấy Tour | VN.TRAVEL",
    };
  }

  const title = `${data.tour.name} | VN.TRAVEL`;
  const description = buildSeoDescription(data.tour.information, data.tour.name);
  const url = `${SITE_URL}/tours/${encodeURIComponent(data.tour.slug)}`;
  const images = data.tour.avatar
    ? [{ url: data.tour.avatar, alt: data.tour.name }]
    : [];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images,
    },
  };
}

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getClientTourBySlug(slug);

  if (!data) {
    notFound();
  }

  const { tour } = data;
  const tourUrl = `${SITE_URL}/tours/${encodeURIComponent(tour.slug)}`;
  const displayPrice =
    tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;
  const description = buildSeoDescription(tour.information, tour.name);

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Trang chủ",
      item: `${SITE_URL}/`,
    },
  ];
  let pos = 2;
  if (tour.category?.parent) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: pos++,
      name: tour.category.parent.name,
      item: `${SITE_URL}/tours?category=${encodeURIComponent(tour.category.parent.slug)}`,
    });
  }
  if (tour.category) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: pos++,
      name: tour.category.name,
      item: `${SITE_URL}/tours?category=${encodeURIComponent(tour.category.slug)}`,
    });
  }
  breadcrumbItems.push({
    "@type": "ListItem",
    position: pos,
    name: tour.name,
    item: tourUrl,
  });

  const touristTripJsonLd: Record<string, unknown> = {
    "@type": "TouristTrip",
    name: tour.name,
    description,
    url: tourUrl,
    ...(tour.avatar ? { image: [tour.avatar] } : {}),
    touristType: "Du khách cá nhân & gia đình",
    offers: {
      "@type": "Offer",
      price: displayPrice,
      priceCurrency: "VND",
      availability:
        tour.stockAdult > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url: tourUrl,
    },
  };

  if ((tour.reviewCount ?? 0) > 0) {
    touristTripJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number((tour.ratingAvg ?? 5).toFixed(1)),
      reviewCount: tour.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      touristTripJsonLd,
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
    ],
  };

  const jsonLdText = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdText }}
      />
      <TourDetailClient
        tour={data.tour}
        relatedTours={data.relatedTours}
        initialReviews={data.initialReviews}
        ratingBreakdown={data.ratingBreakdown}
      />
    </>
  );
}
