import { prisma } from "./prisma";
import { slugify } from "./format";

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
