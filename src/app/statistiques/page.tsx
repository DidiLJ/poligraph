import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
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
import { getVictimStats } from "@/lib/data/affairs";
import { StatsTabs } from "@/components/stats/StatsTabs";
import { LegislativeSection } from "@/components/stats/LegislativeSection";
import { JudicialSection } from "@/components/stats/JudicialSection";
import { FactCheckSection } from "@/components/stats/FactCheckSection";
import { ParticipationSection } from "@/components/stats/ParticipationSection";
import { getHemicycleData } from "@/lib/data/hemicycle";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Statistiques",
  description:
    "Statistiques sur la vie politique française : travail législatif, transparence judiciaire, fact-checking",
  alternates: { canonical: "/statistiques" },
};

// ── Judicial data ────────────────────────────────────────────

async function getJudicialData() {
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

async function getFactCheckData() {
  "use cache";
  cacheTag("statistics", "factchecks");
  cacheLife("minutes");

  return factcheckStatsService.getStatisticsData();
}

// ── Legislative data ─────────────────────────────────────────

async function getLegislativeData() {
  "use cache";
  cacheTag("statistics", "votes", "legislation");
  cacheLife("minutes");

  return voteStatsService.getLegislativeStats();
}

// ── Participation data ────────────────────────────────────────

async function getParticipationData(
  chamber?: Chamber,
  page: number = 1,
  sortDirection: "ASC" | "DESC" = "ASC"
) {
  "use cache";
  cacheTag("statistics", "participation");
  cacheLife("minutes");

  const [ranking, groupStatsAN, groupStatsSENAT] = await Promise.all([
    voteStatsService.getParticipationRanking(chamber, undefined, page, 50, sortDirection),
    voteStatsService.getGroupParticipationStats("AN" as Chamber),
    voteStatsService.getGroupParticipationStats("SENAT" as Chamber),
  ]);

  return { ranking, groupStatsAN, groupStatsSENAT };
}

// ── Page ─────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatistiquesPage({ searchParams }: PageProps) {
  if (!(await isFeatureEnabled("STATISTIQUES_SECTION"))) notFound();

  const params = await searchParams;
  const pChamber =
    params.chamber === "AN" || params.chamber === "SENAT" ? (params.chamber as Chamber) : undefined;
  const pPage = Math.max(1, Math.min(100, parseInt(String(params.pPage ?? "1"), 10) || 1));
  const pSort = params.pSort === "desc" ? ("DESC" as const) : ("ASC" as const);

  const [
    legislativeData,
    judicialData,
    factCheckData,
    participationData,
    hemicycleData,
    victimStats,
  ] = await Promise.all([
    getLegislativeData(),
    getJudicialData(),
    getFactCheckData(),
    getParticipationData(pChamber, pPage, pSort),
    getHemicycleData(),
    getVictimStats(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Statistiques</h1>
      <p className="text-muted-foreground mb-8">
        Vue d&apos;ensemble des données sur la vie politique française
      </p>

      <StatsTabs
        judicialContent={
          <JudicialSection
            certaintyCounts={judicialData.certaintyCounts}
            uniqueCondamnes={judicialData.uniqueCondamnes}
            uniqueMisEnCause={judicialData.uniqueMisEnCause}
            byStatus={judicialData.byStatus}
            byCategory={judicialData.byCategory}
            critiqueByCategory={judicialData.critiqueByCategory}
            hemicycleGroups={hemicycleData}
            victimStats={victimStats}
          />
        }
        factCheckContent={
          <FactCheckSection
            total={factCheckData.total}
            groups={factCheckData.groups}
            bySource={factCheckData.bySource}
            mostReliablePoliticians={factCheckData.mostReliablePoliticians}
            leastReliablePoliticians={factCheckData.leastReliablePoliticians}
            mostReliableParties={factCheckData.mostReliableParties}
            leastReliableParties={factCheckData.leastReliableParties}
          />
        }
        legislativeContent={<LegislativeSection stats={legislativeData} />}
        participationContent={
          <ParticipationSection
            ranking={participationData.ranking}
            groupStatsAN={participationData.groupStatsAN}
            groupStatsSENAT={participationData.groupStatsSENAT}
            chamber={pChamber}
            page={pPage}
            sortDirection={pSort}
          />
        }
      />
    </div>
  );
}
