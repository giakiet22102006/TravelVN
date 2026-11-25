import type { MetadataRoute } from "next";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://travel-vn-kappa.vercel.app"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/tours`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/news`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  try {
    const [tours, categories, articles] = await Promise.all([
      prisma.tour.findMany({
        where: {
          deleted: false,
          status: RecordStatus.ACTIVE,
          category: { deleted: false, status: RecordStatus.ACTIVE },
        },
        select: { slug: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }],
      }),
      prisma.category.findMany({
        where: {
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        select: { slug: true, updatedAt: true },
      }),
      prisma.newsArticle.findMany({
        where: {
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        select: { slug: true, updatedAt: true },
        orderBy: [{ publishedAt: "desc" }],
      }),
    ]);

    const tourRoutes: MetadataRoute.Sitemap = tours.map((t) => ({
      url: `${SITE_URL}/tours/${encodeURIComponent(t.slug)}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly",
      priority: 0.85,
    }));

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${SITE_URL}/tours?category=${encodeURIComponent(c.slug)}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const newsRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
      url: `${SITE_URL}/news/${encodeURIComponent(a.slug)}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly",
      priority: 0.75,
    }));

    return [...baseRoutes, ...tourRoutes, ...categoryRoutes, ...newsRoutes];
  } catch {
    return baseRoutes;
  }
}
