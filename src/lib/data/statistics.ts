import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { voteStatsService } from "@/services/voteStats";
import { factcheckStatsService } from "@/services/factcheckStats";
import {
  CATEGORY_TO_SUPER,
  AFFAIR_CATEGORY_LABELS,
  type AffairSuperCategory,
} from "@/config/labels";
import { getCertaintyLevel, ACTIVE_AFFAIR_STATUSES, type CertaintyLevel } from "@/config/certainty";
import type { AffairStatus, AffairCategory } from "@/types";
import type { Chamber } from "@/generated/prisma";

// ── Judicial data ────────────────────────────────────────────

export async function getJudicialData() {
  "use cache";
  cacheTag("statistics", "affairs");
  cacheLife("minutes");

  const directFilter = {
    publicationStatus: "PUBLISHED" as const,
    involvement: "DIRECT" as const,
  };

  // Single batch: certainty counts + status breakdown + category + critique by party
  const [byStatusRaw, byCategoryRaw, critiqueAffairs, condamnesPoliticians, misEnCausePoliticians] =
    await Promise.all([
      db.affair.groupBy({
        by: ["status"],
        where: directFilter,
        _count: { status: true },
        orderBy: { _count: { status: "desc" } },
      }),
      db.affair.groupBy({
        by: ["category"],
        where: directFilter,
        _count: { category: true },
        orderBy: { _count: { category: "desc" } },
      }),
      db.affair.findMany({
        where: { ...directFilter, severity: "CRITIQUE" },
        select: {
          category: true,
          politician: {
            select: {
              currentParty: {
                select: { name: true, shortName: true, color: true, slug: true },
              },
            },
          },
        },
      }),
      // Unique politicians with Etabli
      db.affair.findMany({
        where: { ...directFilter, status: "CONDAMNATION_DEFINITIVE" },
        select: { politicianId: true },
        distinct: ["politicianId"],
      }),
      // Unique politicians with En cours or Prononce (active non-definitive)
      db.affair.findMany({
        where: {
          ...directFilter,
          status: {
            in: ACTIVE_AFFAIR_STATUSES.filter((s) => s !== "CONDAMNATION_DEFINITIVE"),
          },
        },
        select: { politicianId: true },
        distinct: ["politicianId"],
      }),
    ]);

  // Compute certainty counts from status breakdown
  const certaintyCounts: Record<CertaintyLevel, number> = {
    ETABLI: 0,
    PRONONCE: 0,
    EN_COURS: 0,
    CLOS_FAVORABLE: 0,
  };
  const byStatus = byStatusRaw.map((a) => {
    const level = getCertaintyLevel(a.status);
    certaintyCounts[level] += a._count.status;
    return { status: a.status as AffairStatus, count: a._count.status };
  });

  // Aggregate categories into super-categories (for donut) — all certitudes
  const superCategories: Record<AffairSuperCategory, number> = {
    PROBITE: 0,
    FINANCES: 0,
    PERSONNES: 0,
    EXPRESSION: 0,
    AUTRE: 0,
  };
  byCategoryRaw.forEach((a) => {
    const superCat = CATEGORY_TO_SUPER[a.category as AffairCategory];
    superCategories[superCat] += a._count.category;
  });
  const byCategory = Object.entries(superCategories)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category: category as AffairSuperCategory,
      count,
    }));

  // Aggregate critique affairs: category → party → count
  const critiqueByCategoryParty = new Map<
    string,
    Map<string, { count: number; color: string | null; slug: string | null }>
  >();

  for (const affair of critiqueAffairs) {
    const party = affair.politician.currentParty;
    if (!party) continue;
    const partyKey = party.name || party.shortName || "Autre";

    if (!critiqueByCategoryParty.has(affair.category)) {
      critiqueByCategoryParty.set(affair.category, new Map());
    }
    const partyMap = critiqueByCategoryParty.get(affair.category)!;
    const existing = partyMap.get(partyKey);
    if (existing) {
      existing.count++;
    } else {
      partyMap.set(partyKey, { count: 1, color: party.color, slug: party.slug });
    }
  }

  const critiqueByCategory = [...critiqueByCategoryParty.entries()]
    .map(([category, partyMap]) => {
      const parties = [...partyMap.entries()]
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const total = parties.reduce((sum, p) => sum + p.count, 0);
      return {
        category: category as AffairCategory,
        label: AFFAIR_CATEGORY_LABELS[category as AffairCategory],
        total,
        parties,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    certaintyCounts,
    uniqueCondamnes: condamnesPoliticians.length,
    uniqueMisEnCause: misEnCausePoliticians.length,
    byStatus,
    byCategory,
    critiqueByCategory,
  };
}

// ── Fact-check data ──────────────────────────────────────────

export async function getFactCheckData() {
  "use cache";
  cacheTag("statistics", "factchecks");
  cacheLife("minutes");

  return factcheckStatsService.getStatisticsData();
}

// ── Legislative data ─────────────────────────────────────────

export async function getLegislativeData() {
  "use cache";
  cacheTag("statistics", "votes", "legislation");
  cacheLife("minutes");

  return voteStatsService.getLegislativeStats();
}

// ── Group dynamics data (alignment + cohesion) ───────────────

export async function getGroupDynamicsData() {
  "use cache";
  cacheTag("statistics", "votes", "groupes");
  cacheLife("hours");

  const [dynamicsAN, dynamicsSENAT] = await Promise.all([
    voteStatsService.getGroupDynamicsStats("AN"),
    voteStatsService.getGroupDynamicsStats("SENAT"),
  ]);

  return { dynamicsAN, dynamicsSENAT };
}

// ── Participation data ────────────────────────────────────────

export async function getParticipationData(
  chamber?: Chamber,
  page: number = 1,
  sortDirection: "ASC" | "DESC" = "ASC"
) {
  "use cache";
  cacheTag("statistics", "participation");
  cacheLife("minutes");

  const [ranking, groupStatsAN, groupStatsSENAT, groupDissidenceAN, groupDissidenceSENAT] =
    await Promise.all([
      voteStatsService.getParticipationRanking(chamber, undefined, page, 50, sortDirection),
      voteStatsService.getGroupParticipationStats("AN" as Chamber),
      voteStatsService.getGroupParticipationStats("SENAT" as Chamber),
      voteStatsService.getGroupDissidenceStats("AN"),
      voteStatsService.getGroupDissidenceStats("SENAT"),
    ]);

  return { ranking, groupStatsAN, groupStatsSENAT, groupDissidenceAN, groupDissidenceSENAT };
}
