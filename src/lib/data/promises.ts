import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import type { PromiseExtractionStatus, ThemeCategory } from "@/types";

export interface PromiseFilters {
  status?: PromiseExtractionStatus;
  theme?: ThemeCategory;
  politicianSlug?: string;
  page?: number;
  pageSize?: number;
}

export async function getPromisesForModeration(filters: PromiseFilters) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);

  const where: Prisma.PromiseWhereInput = {
    ...(filters.status && { extractionStatus: filters.status }),
    ...(filters.theme && { theme: filters.theme }),
    ...(filters.politicianSlug && { politician: { slug: filters.politicianSlug } }),
  };

  const [items, total] = await Promise.all([
    db.promise.findMany({
      where,
      include: {
        politician: { select: { slug: true, fullName: true, photoUrl: true } },
      },
      orderBy: [{ extractionStatus: "asc" }, { publishedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.promise.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getPromiseStats() {
  const [total, byStatus, byTheme] = await Promise.all([
    db.promise.count(),
    db.promise.groupBy({ by: ["extractionStatus"], _count: true }),
    db.promise.groupBy({ by: ["theme"], _count: true }),
  ]);
  return { total, byStatus, byTheme };
}

export async function getPromiseById(id: string) {
  return db.promise.findUnique({
    where: { id },
    include: {
      politician: { select: { slug: true, fullName: true, photoUrl: true } },
    },
  });
}
