import { cache } from "react";
import { unstable_cache } from "next/cache";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcDiscountPercent } from "@/lib/format";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface CategoryFlatItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  avatar: string | null;
  position: number;
  description: string | null;
  depth?: number;
}

export interface CategoryTreeItem extends CategoryFlatItem {
  children: CategoryTreeItem[];
}

export interface WebsiteInfoData {
  id: string;
  websiteName: string;
  phone: string;
  email: string;
  address: string;
  logo: string | null;
  favicon: string | null;
}

export const DEFAULT_WEBSITE_INFO: WebsiteInfoData = {
  id: "default",
  websiteName: "VN.TRAVEL",
  phone: "1900 6868",
  email: "contact@vn.travel.com",
  address: "285 Cách Mạng Tháng Tám, Quận 10, TP.HCM",
  logo: null,
  favicon: null,
};

const PRICE_RANGE_FILTERS: Record<string, Prisma.IntFilter> = {
  "under-2m": { lt: 2000000 },
  lt2: { lt: 2000000 },
  "2m-4m": { gte: 2000000, lte: 4000000 },
  "2to4": { gte: 2000000, lte: 4000000 },
  "4m-8m": { gt: 4000000, lte: 8000000 },
  "4to8": { gt: 4000000, lte: 8000000 },
  "over-8m": { gt: 8000000 },
  gt8: { gt: 8000000 },
};

const CLIENT_TOUR_SELECT = {
  id: true,
  code: true,
  name: true,
  slug: true,
  categoryId: true,
  position: true,
  avatar: true,
  priceAdult: true,
  priceChild: true,
  priceBaby: true,
  priceNewAdult: true,
  priceNewChild: true,
  priceNewBaby: true,
  stockAdult: true,
  stockChild: true,
  stockBaby: true,
  locations: true,
  time: true,
  vehicle: true,
  departureDate: true,
  ratingAvg: true,
  reviewCount: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
} satisfies Prisma.TourSelect;

export interface TourReviewUser {
  id: string;
  fullName: string;
  avatar: string | null;
}

export interface TourReviewItem {
  id: string;
  tourId: string;
  userId: string;
  rating: number;
  comment: string;
  isVerifiedBooking: boolean;
  aiSentiment: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: TourReviewUser;
}

export type RatingBreakdownMap = Record<1 | 2 | 3 | 4 | 5, number>;

function serializeTourDates<T extends { departureDate?: Date | string | null }>(
  tour: T
): Omit<T, "departureDate"> & { departureDate: string | null } {
  return {
    ...tour,
    departureDate: tour.departureDate
      ? new Date(tour.departureDate).toISOString()
      : null,
  };
}

const getClientShellDataCached = unstable_cache(
  async () => {
    const [rawCategories, websiteInfoRecord] = await Promise.all([
      prisma.category.findMany({
        where: {
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          avatar: true,
          position: true,
          description: true,
        },
      }),
      prisma.websiteInfo.findUnique({
        where: { id: "default" },
        select: {
          id: true,
          websiteName: true,
          phone: true,
          email: true,
          address: true,
          logo: true,
          favicon: true,
        },
      }),
    ]);

    const nodeMap = new Map<string, CategoryTreeItem>();
    for (const cat of rawCategories) {
      nodeMap.set(cat.id, { ...cat, children: [] });
    }

    const tree: CategoryTreeItem[] = [];
    for (const cat of rawCategories) {
      const node = nodeMap.get(cat.id)!;
      if (cat.parentId && nodeMap.has(cat.parentId)) {
        nodeMap.get(cat.parentId)!.children.push(node);
      } else {
        tree.push(node);
      }
    }

    const orderedFlat: CategoryFlatItem[] = [];
    const flatten = (nodes: CategoryTreeItem[], depth: number) => {
      for (const n of nodes) {
        const { children, ...rest } = n;
        orderedFlat.push({ ...rest, depth });
        if (children.length > 0) flatten(children, depth + 1);
      }
    };
    flatten(tree, 0);

    return {
      categories: orderedFlat,
      tree,
      websiteInfo: websiteInfoRecord ?? DEFAULT_WEBSITE_INFO,
    };
  },
  ["client-shell-data-v1"],
  {
    revalidate: 300,
    tags: [CACHE_TAGS.clientShell],
  }
);

/**
 * Shared cached loader for global client shell metadata (categories tree + websiteInfo).
 * React `cache()` deduplicates calls within one RSC pass; `unstable_cache` persists across requests
 * and is invalidated immediately by Admin category/settings mutations via `revalidateTag`.
 */
export const getClientShellData = cache(async () => getClientShellDataCached());

async function resolveCategoryTreeBySlug(slug: string) {
  const normalized = slug.toLowerCase().trim();
  const { categories } = await getClientShellData();
  const target = categories.find((c) => c.slug.toLowerCase() === normalized);
  if (!target) {
    return { categoryInfo: null, categoryIds: null };
  }

  const childrenByParent = new Map<string, string[]>();
  for (const cat of categories) {
    if (!cat.parentId) continue;
    const list = childrenByParent.get(cat.parentId) ?? [];
    list.push(cat.id);
    childrenByParent.set(cat.parentId, list);
  }

  const collectedIds: string[] = [];
  const queue: string[] = [target.id];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    collectedIds.push(current);

    for (const childId of childrenByParent.get(current) ?? []) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return { categoryInfo: target, categoryIds: collectedIds };
}

export interface ClientToursQueryInput {
  categorySlug?: string;
  keyword?: string;
  destination?: string;
  departureLocation?: string;
  departureDate?: string;
  adult?: number;
  child?: number;
  baby?: number;
  priceRange?: string;
  dealOnly?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

interface NormalizedToursQuery {
  categoryIds: string[] | null;
  keyword: string;
  destination: string;
  departureLocation: string;
  departureDateRaw: string;
  adult: number;
  child: number;
  baby: number;
  priceRange: string;
  dealOnly: boolean;
  sort: string;
  page: number;
  limit: number;
}

function normalizeVietnameseText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 4 || b.length < 4) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) {
      i++;
    } else if (b.length > a.length) {
      j++;
    } else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function matchesSearchTerm(
  tour: { name: string; code: string; slug: string; information?: string | null },
  rawTerm: string
): boolean {
  const normTerm = normalizeVietnameseText(rawTerm);
  if (!normTerm) return true;

  const haystack = normalizeVietnameseText(
    `${tour.name} ${tour.code} ${tour.slug.replace(/-/g, " ")} ${tour.information || ""}`
  );
  const compactHaystack = haystack.replace(/\s+/g, "");
  const compactTerm = normTerm.replace(/\s+/g, "");

  if (haystack.includes(normTerm) || compactHaystack.includes(compactTerm)) {
    return true;
  }

  const queryTokens = normTerm.split(" ").filter(Boolean);
  const candidateTokens = haystack.split(" ").filter(Boolean);

  return queryTokens.every((qt) =>
    candidateTokens.some(
      (ct) =>
        ct === qt ||
        (qt.length >= 4 && ct.includes(qt)) ||
        editDistanceAtMostOne(qt, ct)
    )
  );
}

const executeToursQueryCached = unstable_cache(
  async (serializedParams: string) => {
    const q = JSON.parse(serializedParams) as NormalizedToursQuery;
    const andConditions: Prisma.TourWhereInput[] = [
      { deleted: false },
      { status: RecordStatus.ACTIVE },
      { category: { deleted: false, status: RecordStatus.ACTIVE } },
    ];

    if (q.categoryIds && q.categoryIds.length > 0) {
      andConditions.push({ categoryId: { in: q.categoryIds } });
    }

    if (q.departureLocation) {
      andConditions.push({
        locations: { array_contains: [q.departureLocation] },
      });
    }

    if (q.departureDateRaw) {
      const parsedDate = new Date(q.departureDateRaw);
      if (!Number.isNaN(parsedDate.getTime())) {
        parsedDate.setHours(0, 0, 0, 0);
        andConditions.push({ departureDate: { gte: parsedDate } });
      }
    }

    if (q.adult > 0) andConditions.push({ stockAdult: { gte: q.adult } });
    if (q.child > 0) andConditions.push({ stockChild: { gte: q.child } });
    if (q.baby > 0) andConditions.push({ stockBaby: { gte: q.baby } });

    const priceFilter = PRICE_RANGE_FILTERS[q.priceRange];
    if (priceFilter) {
      andConditions.push({ priceNewAdult: priceFilter });
    }

    const where: Prisma.TourWhereInput = { AND: andConditions };

    const orderByMap: Record<string, Prisma.TourOrderByWithRelationInput[]> = {
      "price-asc": [{ priceNewAdult: "asc" }, { position: "asc" }],
      "price-desc": [{ priceNewAdult: "desc" }, { position: "asc" }],
    };

    const hasTextFilter = Boolean(q.keyword || q.destination);

    if (q.dealOnly || q.sort === "deal" || hasTextFilter) {
      const allMatching = await prisma.tour.findMany({
        where,
        select: {
          ...CLIENT_TOUR_SELECT,
          information: hasTextFilter,
        },
        orderBy:
          orderByMap[q.sort] ?? [{ position: "asc" }, { createdAt: "desc" }],
      });

      let filtered = allMatching;

      if (q.keyword) {
        filtered = filtered.filter((t) => matchesSearchTerm(t, q.keyword));
      }
      if (q.destination) {
        filtered = filtered.filter((t) => matchesSearchTerm(t, q.destination));
      }
      if (q.dealOnly) {
        filtered = filtered.filter(
          (t) => calcDiscountPercent(t.priceAdult, t.priceNewAdult) > 0
        );
      }

      if (q.sort === "deal") {
        filtered = [...filtered].sort(
          (a, b) =>
            calcDiscountPercent(b.priceAdult, b.priceNewAdult) -
            calcDiscountPercent(a.priceAdult, a.priceNewAdult)
        );
      } else if (q.sort === "price-asc") {
        filtered = [...filtered].sort(
          (a, b) =>
            (a.priceNewAdult - b.priceNewAdult) ||
            (a.position - b.position)
        );
      } else if (q.sort === "price-desc") {
        filtered = [...filtered].sort(
          (a, b) =>
            (b.priceNewAdult - a.priceNewAdult) ||
            (a.position - b.position)
        );
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / q.limit));
      const effectivePage = Math.min(q.page, totalPages);
      const paged = filtered
        .slice((effectivePage - 1) * q.limit, effectivePage * q.limit)
        .map(serializeTourDates);

      return {
        tours: paged,
        total,
        page: effectivePage,
        totalPages,
      };
    }

    const total = await prisma.tour.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / q.limit));
    const effectivePage = Math.min(q.page, totalPages);

    const tours = await prisma.tour.findMany({
      where,
      select: CLIENT_TOUR_SELECT,
      orderBy:
        orderByMap[q.sort] ?? [{ position: "asc" }, { createdAt: "desc" }],
      skip: (effectivePage - 1) * q.limit,
      take: q.limit,
    });

    return {
      tours: tours.map(serializeTourDates),
      total,
      page: effectivePage,
      totalPages,
    };
  },
  ["client-tours-query-v3"],
  {
    revalidate: 120,
    tags: [CACHE_TAGS.clientTours],
  }
);

export const queryClientTours = cache(async (input: ClientToursQueryInput) => {
  const categorySlug = input.categorySlug?.trim() || "";
  const page = Math.max(1, input.page && input.page > 0 ? Math.floor(input.page) : 1);
  const limit = Math.min(
    50,
    Math.max(1, input.limit && input.limit > 0 ? Math.floor(input.limit) : 9)
  );

  let categoryInfo: CategoryFlatItem | null = null;
  let categoryIds: string[] | null = null;

  if (categorySlug) {
    const resolved = await resolveCategoryTreeBySlug(categorySlug);
    categoryInfo = resolved.categoryInfo;
    categoryIds = resolved.categoryIds;
    if (!categoryIds) {
      return {
        tours: [],
        total: 0,
        page,
        totalPages: 1,
        categoryInfo: null,
      };
    }
  }

  const normalized: NormalizedToursQuery = {
    categoryIds,
    keyword: input.keyword?.trim() || "",
    destination: input.destination?.trim() || "",
    departureLocation: input.departureLocation?.trim() || "",
    departureDateRaw: input.departureDate?.trim() || "",
    adult: input.adult && input.adult > 0 ? Math.floor(input.adult) : 0,
    child: input.child && input.child > 0 ? Math.floor(input.child) : 0,
    baby: input.baby && input.baby > 0 ? Math.floor(input.baby) : 0,
    priceRange: input.priceRange?.trim() || "",
    dealOnly: Boolean(input.dealOnly),
    sort: input.sort?.trim() || "",
    page,
    limit,
  };

  const result = await executeToursQueryCached(JSON.stringify(normalized));
  return {
    ...result,
    categoryInfo,
  };
});

const getClientTourBySlugCached = unstable_cache(
  async (slug: string) => {
    const tour = await prisma.tour.findFirst({
      where: {
        slug,
        deleted: false,
        status: RecordStatus.ACTIVE,
        category: { deleted: false, status: RecordStatus.ACTIVE },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!tour) return null;

    const [sameCategoryTours, rawReviews, groupedRatings] = await Promise.all([
      prisma.tour.findMany({
        where: {
          id: { not: tour.id },
          categoryId: tour.categoryId,
          deleted: false,
          status: RecordStatus.ACTIVE,
          category: { deleted: false, status: RecordStatus.ACTIVE },
        },
        select: CLIENT_TOUR_SELECT,
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        take: 4,
      }),
      prisma.review.findMany({
        where: {
          tourId: tour.id,
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          tourId: true,
          userId: true,
          rating: true,
          comment: true,
          isVerifiedBooking: true,
          aiSentiment: true,
          adminReply: true,
          repliedAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: {
          tourId: tour.id,
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        _count: { rating: true },
      }),
    ]);

    const ratingBreakdown: RatingBreakdownMap = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of groupedRatings) {
      if (row.rating >= 1 && row.rating <= 5) {
        ratingBreakdown[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
      }
    }

    let relatedTours = sameCategoryTours;

    if (relatedTours.length < 4 && tour.category?.parentId) {
      const siblingCategoryTours = await prisma.tour.findMany({
        where: {
          id: { notIn: [tour.id, ...relatedTours.map((t) => t.id)] },
          deleted: false,
          status: RecordStatus.ACTIVE,
          category: {
            parentId: tour.category.parentId,
            deleted: false,
            status: RecordStatus.ACTIVE,
          },
        },
        select: CLIENT_TOUR_SELECT,
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        take: 4 - relatedTours.length,
      });
      relatedTours = [...relatedTours, ...siblingCategoryTours];
    }

    const initialReviews: TourReviewItem[] = rawReviews.map((rev) => ({
      ...rev,
      repliedAt: rev.repliedAt ? rev.repliedAt.toISOString() : null,
      createdAt: rev.createdAt.toISOString(),
    }));

    return {
      tour: {
        ...tour,
        departureDate: tour.departureDate
          ? tour.departureDate.toISOString()
          : null,
        createdAt: tour.createdAt.toISOString(),
        updatedAt: tour.updatedAt.toISOString(),
        deletedAt: tour.deletedAt ? tour.deletedAt.toISOString() : null,
      },
      relatedTours: relatedTours.map(serializeTourDates),
      initialReviews,
      ratingBreakdown,
    };
  },
  ["client-tour-detail-v2"],
  {
    revalidate: 120,
    tags: [CACHE_TAGS.clientTours],
  }
);

export const getClientTourBySlug = cache(async (slug: string) =>
  getClientTourBySlugCached(slug)
);

export interface ClientNewsItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  avatar: string | null;
  featured: boolean;
  views: number;
  relatedDestination: string | null;
  position: number;
  publishedAt: string;
}

export interface ClientNewsDetailItem extends ClientNewsItem {
  content: string;
  createdBy: { fullName: string } | null;
}

const CLIENT_NEWS_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  category: true,
  excerpt: true,
  avatar: true,
  featured: true,
  views: true,
  relatedDestination: true,
  position: true,
  publishedAt: true,
} satisfies Prisma.NewsArticleSelect;

function serializeNewsItem<T extends { publishedAt: Date }>(
  item: T
): Omit<T, "publishedAt"> & { publishedAt: string } {
  return {
    ...item,
    publishedAt: item.publishedAt.toISOString(),
  };
}

export const getHomeHotNews = unstable_cache(
  async (): Promise<ClientNewsItem[]> => {
    const rows = await prisma.newsArticle.findMany({
      where: {
        deleted: false,
        status: RecordStatus.ACTIVE,
      },
      select: CLIENT_NEWS_CARD_SELECT,
      orderBy: [
        { featured: "desc" },
        { position: "asc" },
        { publishedAt: "desc" },
      ],
      take: 5,
    });
    return rows.map(serializeNewsItem);
  },
  ["client-home-hot-news-v1"],
  {
    revalidate: 120,
    tags: [CACHE_TAGS.clientNews],
  }
);

export interface ClientNewsQueryInput {
  category?: string;
  keyword?: string;
  page?: number;
  limit?: number;
}

const executeNewsQueryCached = unstable_cache(
  async (serializedParams: string) => {
    const q = JSON.parse(serializedParams) as {
      category: string;
      keyword: string;
      page: number;
      limit: number;
    };

    const allActive = await prisma.newsArticle.findMany({
      where: {
        deleted: false,
        status: RecordStatus.ACTIVE,
      },
      select: {
        ...CLIENT_NEWS_CARD_SELECT,
        content: Boolean(q.keyword),
      },
      orderBy: [
        { featured: "desc" },
        { position: "asc" },
        { publishedAt: "desc" },
      ],
    });

    const categoriesSet = new Set<string>();
    for (const item of allActive) {
      if (item.category) categoriesSet.add(item.category);
    }

    let filtered = allActive;
    if (q.category) {
      const targetCat = normalizeVietnameseText(q.category);
      filtered = filtered.filter(
        (item) => normalizeVietnameseText(item.category) === targetCat
      );
    }
    if (q.keyword) {
      const normKw = normalizeVietnameseText(q.keyword);
      const tokens = normKw.split(" ").filter(Boolean);
      filtered = filtered.filter((item) => {
        const hay = normalizeVietnameseText(
          `${item.title} ${item.excerpt} ${item.category} ${item.relatedDestination || ""} ${item.content || ""}`
        );
        if (hay.includes(normKw)) return true;
        const hayTokens = hay.split(" ").filter(Boolean);
        return tokens.every((qt) =>
          hayTokens.some(
            (ct) =>
              ct === qt ||
              (qt.length >= 4 && ct.includes(qt)) ||
              editDistanceAtMostOne(qt, ct)
          )
        );
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / q.limit));
    const effectivePage = Math.min(q.page, totalPages);

    const paged = filtered
      .slice((effectivePage - 1) * q.limit, effectivePage * q.limit)
      .map((item) => {
        const { content: _discard, ...rest } = item;
        void _discard;
        return serializeNewsItem(rest);
      });

    return {
      articles: paged,
      total,
      page: effectivePage,
      totalPages,
      categories: Array.from(categoriesSet),
    };
  },
  ["client-news-query-v1"],
  {
    revalidate: 120,
    tags: [CACHE_TAGS.clientNews],
  }
);

export const queryClientNews = cache(async (input: ClientNewsQueryInput = {}) => {
  const page = Math.max(1, input.page && input.page > 0 ? Math.floor(input.page) : 1);
  const limit = Math.max(
    1,
    Math.min(24, input.limit && input.limit > 0 ? Math.floor(input.limit) : 9)
  );
  return executeNewsQueryCached(
    JSON.stringify({
      category: input.category?.trim() || "",
      keyword: input.keyword?.trim() || "",
      page,
      limit,
    })
  );
});

const getClientNewsBySlugCached = unstable_cache(
  async (slug: string) => {
    const article = await prisma.newsArticle.findFirst({
      where: {
        slug,
        deleted: false,
        status: RecordStatus.ACTIVE,
      },
      select: {
        ...CLIENT_NEWS_CARD_SELECT,
        content: true,
        createdBy: { select: { fullName: true } },
      },
    });

    if (!article) return null;

    const [otherArticles, candidateTours] = await Promise.all([
      prisma.newsArticle.findMany({
        where: {
          id: { not: article.id },
          deleted: false,
          status: RecordStatus.ACTIVE,
        },
        select: CLIENT_NEWS_CARD_SELECT,
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
        take: 6,
      }),
      prisma.tour.findMany({
        where: {
          deleted: false,
          status: RecordStatus.ACTIVE,
          category: { deleted: false, status: RecordStatus.ACTIVE },
        },
        select: {
          ...CLIENT_TOUR_SELECT,
          information: true,
        },
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      }),
    ]);

    const sameCat = otherArticles.filter((a) => a.category === article.category);
    const otherCat = otherArticles.filter((a) => a.category !== article.category);
    const relatedNews = [...sameCat, ...otherCat].slice(0, 3).map(serializeNewsItem);

    let matchedTours = article.relatedDestination
      ? candidateTours.filter((t) =>
          matchesSearchTerm(t, article.relatedDestination!)
        )
      : [];
    if (matchedTours.length === 0) {
      matchedTours = candidateTours.slice(0, 3);
    }

    const relatedTours = matchedTours.slice(0, 3).map((t) => {
      const { information: _discard, ...rest } = t;
      void _discard;
      return serializeTourDates(rest);
    });

    return {
      article: serializeNewsItem(article) as ClientNewsDetailItem,
      relatedNews,
      relatedTours,
    };
  },
  ["client-news-detail-v1"],
  {
    revalidate: 120,
    tags: [CACHE_TAGS.clientNews],
  }
);

export const getClientNewsBySlug = cache(async (slug: string) =>
  getClientNewsBySlugCached(slug)
);
