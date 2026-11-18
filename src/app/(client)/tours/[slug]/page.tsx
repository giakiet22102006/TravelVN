import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientTourBySlug } from "@/lib/client-data";
import { TourDetailClient } from "@/components/client/TourDetailClient";

export const dynamic = "force-dynamic";

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
  return {
    title: `${data.tour.name} | VN.TRAVEL`,
    description: data.tour.information || data.tour.name,
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

  return (
    <TourDetailClient
      tour={data.tour}
      relatedTours={data.relatedTours}
      initialReviews={data.initialReviews}
      ratingBreakdown={data.ratingBreakdown}
    />
  );
}
