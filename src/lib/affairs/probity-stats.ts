import { db } from "@/lib/db";
import { getCategoriesForSuper } from "@/config/labels";
import { getCertaintyLevel, type CertaintyLevel } from "@/config/certainty";

export interface ProbityStats {
  total: number;
  etabli: number;
  prononce: number;
  enCours: number;
  closFavorable: number;
}

const EMPTY_STATS: ProbityStats = {
  total: 0,
  etabli: 0,
  prononce: 0,
  enCours: 0,
  closFavorable: 0,
};

const BUCKET_FIELD: Record<CertaintyLevel, keyof Omit<ProbityStats, "total">> = {
  ETABLI: "etabli",
  PRONONCE: "prononce",
  EN_COURS: "enCours",
  CLOS_FAVORABLE: "closFavorable",
};

const PROBITY_CATEGORIES = getCategoriesForSuper("PROBITE");

export function formatProbityBreakdown(stats: ProbityStats): string {
  if (stats.total === 0) return "Présomption d'innocence";
  const parts: string[] = [];
  if (stats.etabli > 0) parts.push(`${stats.etabli} établie${stats.etabli > 1 ? "s" : ""}`);
  if (stats.prononce > 0) parts.push(`${stats.prononce} prononcée${stats.prononce > 1 ? "s" : ""}`);
  if (stats.enCours > 0) parts.push(`${stats.enCours} en cours`);
  if (stats.closFavorable > 0)
    parts.push(`${stats.closFavorable} close${stats.closFavorable > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export async function getProbityStats(politicianId: string): Promise<ProbityStats> {
  const rows = await db.affair.groupBy({
    by: ["status"],
    where: {
      politicianId,
      publicationStatus: "PUBLISHED",
      category: { in: PROBITY_CATEGORIES },
      involvement: { in: ["DIRECT", "INDIRECT"] },
    },
    _count: { _all: true },
  });
  const stats = { ...EMPTY_STATS };
  for (const row of rows) {
    const level = getCertaintyLevel(row.status);
    const field = BUCKET_FIELD[level];
    stats[field] += row._count._all;
    stats.total += row._count._all;
  }
  return stats;
}
