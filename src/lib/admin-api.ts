import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { slugify } from "./format";
import {
  type OrderItemInventoryPayload,
  restoreOrderInventoryShared,
} from "./order-holds";

export type OrderItemStockInput = OrderItemInventoryPayload;

/**
 * Restores tour seat inventory atomically inside an open Prisma transaction
 * when an order is cancelled or deleted before cancellation.
 */
export async function restoreOrderInventory(
  tx: Prisma.TransactionClient,
  items: OrderItemStockInput[]
) {
  await restoreOrderInventoryShared(tx, items);
}

export interface TourPriceInput {
  priceAdult: number;
  priceChild: number;
  priceBaby: number;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
}

export function validateTourPrices(prices: TourPriceInput): string | null {
  const pairs: Array<{ label: string; oldPrice: number; newPrice: number }> = [
    {
      label: "Người lớn",
      oldPrice: prices.priceAdult,
      newPrice: prices.priceNewAdult,
    },
    {
      label: "Trẻ em",
      oldPrice: prices.priceChild,
      newPrice: prices.priceNewChild,
    },
    {
      label: "Em bé",
      oldPrice: prices.priceBaby,
      newPrice: prices.priceNewBaby,
    },
  ];

  for (const { label, oldPrice, newPrice } of pairs) {
    if (oldPrice < 0 || newPrice < 0) {
      return `Giá ${label.toLowerCase()} không được là số âm`;
    }
    if (oldPrice > 0 && newPrice > oldPrice) {
      return `Giá mới (${label}) không được lớn hơn giá gốc`;
    }
  }

  return null;
}

/**
 * Prevents soft-deleting categories that still hold active child categories or active tours.
 */
export async function validateCategoriesDeletable(
  ids: string[]
): Promise<string | null> {
  if (ids.length === 0) return null;

  const [childCount, tourCount] = await Promise.all([
    prisma.category.count({
      where: {
        parentId: { in: ids },
        id: { notIn: ids },
        deleted: false,
      },
    }),
    prisma.tour.count({
      where: {
        categoryId: { in: ids },
        deleted: false,
      },
    }),
  ]);

  if (tourCount > 0 || childCount > 0) {
    const reasons: string[] = [];
    if (tourCount > 0) reasons.push(`${tourCount} tour đang hoạt động`);
    if (childCount > 0) reasons.push(`${childCount} danh mục con`);
    return `Không thể xóa danh mục vì vẫn còn ${reasons.join(" và ")}. Vui lòng chuyển hoặc xóa các mục liên quan trước.`;
  }

  return null;
}

export function buildDateRangeFilter(
  startDate?: string | null,
  endDate?: string | null
) {
  if (!startDate && !endDate) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (startDate) {
    filter.gte = new Date(`${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    filter.lte = new Date(`${endDate}T23:59:59.999Z`);
  }
  return filter;
}

export async function generateUniqueCategorySlug(
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name) || "danh-muc";
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.category.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

export async function generateUniqueTourSlug(
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name) || "tour";
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.tour.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

export async function generateUniqueTourCode(): Promise<string> {
  const count = await prisma.tour.count();
  let seq = count + 1;
  while (true) {
    const code = `TOUR${String(seq).padStart(5, "0")}`;
    const existing = await prisma.tour.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
    seq++;
  }
}

export async function generateUniqueNewsSlug(
  title: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(title) || "tin-tuc";
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.newsArticle.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
}
