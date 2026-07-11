import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { AffairStatus } from "@/types";

export type SlappAffairFilters = {
  status?: AffairStatus;
  limit?: number;
};

export async function getSlappAffairs(filters: SlappAffairFilters) {
  "use cache";
  cacheTag("affairs", "slapp");
  cacheLife("synced");

  return db.affair.findMany({
    where: {
      isSlapp: true,
      publicationStatus: "PUBLISHED",
      ...(filters.status ? { status: filters.status } : {}),
    },
    take: filters.limit,
    orderBy: { slappQualifiedAt: "desc" },
    include: {
      politician: {
        select: {
          id: true,
          slug: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      },
      sources: { take: 3 },
    },
  });
}

export async function getSlappStats() {
  "use cache";
  cacheTag("affairs", "slapp");
  cacheLife("synced");

  const [total, byStatusRaw] = await Promise.all([
    db.affair.count({
      where: { isSlapp: true, publicationStatus: "PUBLISHED" },
    }),
    db.affair.groupBy({
      by: ["status"],
      where: { isSlapp: true, publicationStatus: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw) {
    byStatus[row.status as string] = row._count._all;
  }

  return { total, byStatus };
}
