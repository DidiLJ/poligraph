import { cache } from "react";
import { cacheTag, cacheLife } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { primarySurname } from "@/lib/name-matching";
import { NATIONAL_MANDATE_TYPES } from "@/config/labels";

// ============================================
// Incumbent maire helper
// ============================================

/** Fetch the incumbent maire for a commune + check if they're running again in 2026. */
async function getIncumbentMaire(communeId: string, electionId: string) {
  const maireMandate = await db.mandate.findFirst({
    where: {
      type: "MAIRE",
      isCurrent: true,
      localData: { communeId },
    },
    include: {
      politician: {
        select: {
          slug: true,
          fullName: true,
          photoUrl: true,
          blobPhotoUrl: true,
          lastName: true,
          civility: true,
          currentParty: { select: { shortName: true, color: true } },
        },
      },
      localData: true,
    },
  });

  if (!maireMandate) return null;

  // Check if running again: match by lastName in candidacies for this commune.
  // For double surnames (e.g. "Libert Albanel"), also try the primary surname ("Libert")
  // since ballot names are often shorter than the full legal name in the RNE.
  const primary = primarySurname(maireMandate.politician.lastName.toLowerCase());

  const candidacy = await db.candidacy.findFirst({
    where: {
      electionId,
      communeId,
      OR: [
        { candidateName: { contains: maireMandate.politician.lastName, mode: "insensitive" } },
        ...(primary
          ? [
              {
                candidateName: {
                  contains: primary,
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
      ],
    },
    select: { id: true, listName: true, listPosition: true },
  });

  // Return a shape compatible with IncumbentMaireCard and commune page consumers.
  // civility "Mme"/"M." is mapped to legacy "F"/"M" for gender checks in components.
  const maire = {
    fullName: maireMandate.politician.fullName,
    lastName: maireMandate.politician.lastName,
    gender: maireMandate.politician.civility === "Mme" ? "F" : "M",
    mandateStart: maireMandate.startDate,
    partyLabel: maireMandate.localData?.partyLabel ?? null,
    party: maireMandate.politician.currentParty,
    politician: {
      slug: maireMandate.politician.slug,
      fullName: maireMandate.politician.fullName,
      photoUrl: maireMandate.politician.photoUrl,
      blobPhotoUrl: maireMandate.politician.blobPhotoUrl,
    },
  };

  return {
    maire,
    isRunningAgain: !!candidacy,
    candidacy,
  };
}

// ============================================
// Shared types
// ============================================

export interface MunicipalesStats {
  totalCandidacies: number;
  totalLists: number;
  totalCommunes: number;
  communesWithCompetition: number;
  communesUncontested: number;
  averageCompetitionIndex: number;
  parityRate: number;
  parityByParty: Record<string, number>;
  nationalPoliticiansCandidates: number;
  mostContestedCommunes: Array<{
    id: string;
    name: string;
    departmentCode: string;
    population: number | null;
    listCount: number;
  }>;
}

// ============================================
// Stats snapshot
// ============================================

export const getMunicipalesStats = cache(async function getMunicipalesStats() {
  const snapshot = await db.statsSnapshot.findUnique({
    where: { key: "municipales-2026" },
  });
  return snapshot?.data as MunicipalesStats | null;
});

export interface ResultatsStats {
  communesDepouillees: number;
  participationMoyenne: number;
  eluesT1: number;
  auSecondTour: number;
}

export const getResultatsStats = cache(async function getResultatsStats() {
  const snapshot = await db.statsSnapshot.findUnique({
    where: { key: "municipales-2026-resultats" },
  });
  return snapshot?.data as ResultatsStats | null;
});

// ============================================
// Resultats listing (communes with T1 results)
// ============================================

export interface CommuneResultRow {
  id: string;
  name: string;
  departmentCode: string;
  population: number | null;
  participationRate: number;
  topListName: string | null;
  topLeaderName: string | null;
  topPct: number | null;
  topVotes: number | null;
  hasElected: boolean;
  listCount: number;
}

export async function getResultatsListing(options: {
  page?: number;
  pageSize?: number;
  dept?: string;
  electedOnly?: boolean;
}) {
  "use cache";
  cacheTag("elections");
  cacheLife("minutes");

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true, round2Date: true },
  });
  if (!election) return null;

  const deptFilter = options.dept
    ? Prisma.sql`AND co."departmentCode" = ${options.dept}`
    : Prisma.empty;
  const electedFilter = options.electedOnly
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Candidacy" ce WHERE ce."communeId" = co.id AND ce."electionId" = ${election.id} AND ce."isElected" = true)`
    : Prisma.empty;

  const communes = await db.$queryRaw<CommuneResultRow[]>(Prisma.sql`
    SELECT
      co.id,
      co.name,
      co."departmentCode",
      co.population,
      cer."participationRate"::float AS "participationRate",
      top_list."listName" AS "topListName",
      top_list."leaderName" AS "topLeaderName",
      top_list."round1Pct"::float AS "topPct",
      top_list."round1Votes"::int AS "topVotes",
      COALESCE(top_list."isElected", false) AS "hasElected",
      (SELECT COUNT(DISTINCT c2."listName")::int FROM "Candidacy" c2 WHERE c2."communeId" = co.id AND c2."electionId" = ${election.id}) AS "listCount"
    FROM "Commune" co
    INNER JOIN "CommuneElectionRound" cer
      ON cer."communeId" = co.id AND cer."electionId" = ${election.id} AND cer.round = 1
    LEFT JOIN LATERAL (
      SELECT c."listName", c."round1Pct", c."round1Votes", c."isElected",
             STRING_AGG(CASE WHEN c."listPosition" = 1 THEN c."candidateName" END, ', ') AS "leaderName"
      FROM "Candidacy" c
      WHERE c."communeId" = co.id AND c."electionId" = ${election.id} AND c."round1Pct" IS NOT NULL
      GROUP BY c."listName", c."round1Pct", c."round1Votes", c."isElected"
      ORDER BY c."round1Pct" DESC
      LIMIT 1
    ) top_list ON true
    WHERE 1=1 ${deptFilter} ${electedFilter}
    ORDER BY
      co.population DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const [{ total }] = await db.$queryRaw<[{ total: number }]>(Prisma.sql`
    SELECT COUNT(*)::int AS total
    FROM "Commune" co
    INNER JOIN "CommuneElectionRound" cer
      ON cer."communeId" = co.id AND cer."electionId" = ${election.id} AND cer.round = 1
    WHERE 1=1 ${deptFilter} ${electedFilter}
  `);

  return {
    communes,
    total,
    totalPages: Math.ceil(total / pageSize),
    round2Date: election.round2Date,
  };
}

export const getCommune = cache(async function getCommune(inseeCode: string) {
  // Get commune
  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
  });

  if (!commune) return null;

  // Get election for municipales 2026 (sequential to respect pool limit of 2)
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true, round1Date: true, round2Date: true },
  });

  if (!election) {
    return {
      ...commune,
      electionId: null,
      round1Date: null,
      round2Date: null,
      lists: [] as never[],
      incumbentMaire: null,
      hasResults: false,
      participation: null,
      stats: {
        listCount: 0,
        candidateCount: 0,
        femaleRate: 0,
        nationalPoliticiansCount: 0,
      },
    };
  }

  // Get all candidacies for this commune in this election, with candidate + politician data
  const candidacies = await db.candidacy.findMany({
    where: { electionId: election.id, communeId: inseeCode },
    include: {
      candidate: true,
      politician: {
        select: {
          id: true,
          slug: true,
          fullName: true,
          photoUrl: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true },
          },
        },
      },
    },
    orderBy: [{ listName: "asc" }, { listPosition: "asc" }],
  });

  // After candidacies fetch, load participation stats for linked politicians
  const politicianIds = candidacies
    .filter((c) => c.politicianId != null)
    .map((c) => c.politicianId!);

  const participationMap = new Map<string, number>();
  const affairsCountMap = new Map<string, number>();

  if (politicianIds.length > 0) {
    const participations = await db.politicianParticipation.findMany({
      where: { politicianId: { in: politicianIds } },
      select: { politicianId: true, participationRate: true },
    });
    for (const p of participations) {
      participationMap.set(p.politicianId, p.participationRate);
    }

    // Count affairs per politician
    const affairsCounts = await db.affair.groupBy({
      by: ["politicianId"],
      where: { politicianId: { in: politicianIds } },
      _count: true,
    });
    for (const a of affairsCounts) {
      affairsCountMap.set(a.politicianId, a._count);
    }
  }

  // Fetch incumbent maire (sequential to respect pool limit of 2)
  const incumbentMaire = await getIncumbentMaire(inseeCode, election.id);

  // Fetch T1 participation (sequential to respect pool limit of 2)
  const communeRound = await db.communeElectionRound.findUnique({
    where: {
      communeId_electionId_round: {
        communeId: inseeCode,
        electionId: election.id,
        round: 1,
      },
    },
  });

  // Group candidacies by list
  type EnrichedCandidacy = (typeof candidacies)[number] & {
    participationRate?: number | null;
    affairsCount?: number;
  };

  const listsMap = new Map<string, EnrichedCandidacy[]>();
  for (const c of candidacies) {
    const key = c.listName || "Sans liste";
    const list = listsMap.get(key) || [];
    const enriched: EnrichedCandidacy = {
      ...c,
      participationRate: c.politicianId ? (participationMap.get(c.politicianId) ?? null) : null,
      affairsCount: c.politicianId ? (affairsCountMap.get(c.politicianId) ?? 0) : 0,
    };
    list.push(enriched);
    listsMap.set(key, list);
  }

  // Detect if results are available
  const hasResults = candidacies.some((c) => c.round1Votes !== null);

  const lists = Array.from(listsMap.entries())
    .map(([name, members]) => {
      // Results are per-list: all members share the same values
      const firstWithResults = members.find((m) => m.round1Votes !== null);
      // Convert Decimal fields to Number to cross RSC→Client boundary
      const sanitizedMembers = members.map((m) => ({
        ...m,
        round1Pct: m.round1Pct != null ? Number(m.round1Pct) : null,
        round2Pct: m.round2Pct != null ? Number(m.round2Pct) : null,
      }));
      return {
        name,
        partyLabel: members[0]?.partyLabel || null,
        candidateCount: members.length,
        femaleCount: members.filter((m) => m.candidate?.gender === "F").length,
        teteDeListe: (sanitizedMembers.find((m) => m.listPosition === 1) || sanitizedMembers[0])!,
        members: sanitizedMembers,
        // Results (null if not yet imported)
        round1Pct: firstWithResults?.round1Pct ? Number(firstWithResults.round1Pct) : null,
        round1Votes: firstWithResults?.round1Votes ?? null,
        round1Qualified: firstWithResults?.round1Qualified ?? null,
        isElected: firstWithResults?.isElected ?? false,
      };
    })
    // Sort by score DESC when results exist, otherwise keep original order
    .sort((a, b) => {
      if (!hasResults) return 0;
      return (b.round1Pct ?? -1) - (a.round1Pct ?? -1);
    });

  const totalCandidates = candidacies.length;
  const femaleCount = candidacies.filter((c) => c.candidate?.gender === "F").length;
  const femaleRate = totalCandidates > 0 ? femaleCount / totalCandidates : 0;
  const nationalMandateSet = new Set<string>(NATIONAL_MANDATE_TYPES);
  const nationalPoliticiansCount = candidacies.filter(
    (c) => c.politician?.mandates?.some((m) => nationalMandateSet.has(m.type)) ?? false
  ).length;

  return {
    ...commune,
    electionId: election.id,
    round1Date: election.round1Date,
    round2Date: election.round2Date ?? null,
    lists,
    incumbentMaire,
    hasResults,
    participation: communeRound
      ? {
          registeredVoters: communeRound.registeredVoters ?? 0,
          actualVoters: communeRound.actualVoters ?? 0,
          participationRate: Number(communeRound.participationRate ?? 0),
        }
      : null,
    stats: {
      listCount: lists.length,
      candidateCount: totalCandidates,
      femaleRate,
      nationalPoliticiansCount,
    },
  };
});

export async function getDepartmentPartyData() {
  "use cache";
  cacheTag("elections");
  cacheLife("hours");

  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  // Raw SQL: for each department, count distinct lists per partyLabel
  const rows = await db.$queryRaw<
    Array<{
      departmentCode: string;
      departmentName: string;
      partyLabel: string;
      listCount: number;
    }>
  >(Prisma.sql`
    SELECT co."departmentCode", co."departmentName", c."partyLabel", COUNT(DISTINCT c."listName")::int as "listCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    WHERE c."electionId" = ${election.id} AND c."partyLabel" IS NOT NULL
    GROUP BY co."departmentCode", co."departmentName", c."partyLabel"
    ORDER BY co."departmentCode", "listCount" DESC
  `);

  // Aggregate: for each department, find the dominant party and build parties list
  const deptMap = new Map<
    string,
    {
      code: string;
      name: string;
      parties: Array<{ label: string; listCount: number }>;
      totalLists: number;
    }
  >();
  for (const row of rows) {
    const existing = deptMap.get(row.departmentCode) || {
      code: row.departmentCode,
      name: row.departmentName,
      parties: [],
      totalLists: 0,
    };
    existing.parties.push({ label: row.partyLabel, listCount: row.listCount });
    existing.totalLists += row.listCount;
    deptMap.set(row.departmentCode, existing);
  }

  return Array.from(deptMap.values()).map((dept) => ({
    ...dept,
    dominantParty: dept.parties[0]?.label ?? null, // Already sorted by listCount DESC
  }));
}

export const getParityBySize = cache(async function getParityBySize() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  const rows = await db.$queryRaw<
    Array<{
      bracket: string;
      femaleCount: number;
      totalCount: number;
    }>
  >(Prisma.sql`
    SELECT
      CASE
        WHEN co.population < 1000 THEN '< 1 000 hab.'
        WHEN co.population < 10000 THEN '1 000 - 10 000 hab.'
        WHEN co.population < 50000 THEN '10 000 - 50 000 hab.'
        ELSE '50 000+ hab.'
      END as bracket,
      COUNT(*) FILTER (WHERE ca."gender" = 'F')::int as "femaleCount",
      COUNT(*)::int as "totalCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${election.id} AND ca."gender" IS NOT NULL AND co.population IS NOT NULL
    GROUP BY bracket
    ORDER BY MIN(co.population)
  `);

  return rows.map((r) => ({
    bracket: r.bracket,
    femaleRate: r.totalCount > 0 ? r.femaleCount / r.totalCount : 0,
    femaleCount: r.femaleCount,
    maleCount: r.totalCount - r.femaleCount,
    totalCount: r.totalCount,
  }));
});

export const getCumulCandidates = cache(async function getCumulCandidates() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  // Get candidacies with linked politicians who have active national mandates
  const candidacies = await db.candidacy.findMany({
    where: {
      electionId: election.id,
      politicianId: { not: null },
      politician: {
        mandates: {
          some: {
            isCurrent: true,
            type: { in: NATIONAL_MANDATE_TYPES },
          },
        },
      },
    },
    select: {
      id: true,
      candidateName: true,
      listName: true,
      listPosition: true,
      communeId: true,
      commune: { select: { name: true, departmentCode: true } },
      politician: {
        select: {
          id: true,
          slug: true,
          fullName: true,
          photoUrl: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true },
          },
        },
      },
    },
    orderBy: { candidateName: "asc" },
  });

  // Deduplicate by politician: keep only the best candidacy per politician
  // (tête de liste / lowest position, then first alphabetically)
  const byPolitician = new Map<string, (typeof candidacies)[number]>();
  for (const c of candidacies) {
    const pid = c.politician?.id;
    if (!pid) continue;
    const existing = byPolitician.get(pid);
    if (!existing || (c.listPosition ?? Infinity) < (existing.listPosition ?? Infinity)) {
      byPolitician.set(pid, c);
    }
  }

  return [...byPolitician.values()].sort((a, b) =>
    (a.politician?.fullName ?? a.candidateName).localeCompare(
      b.politician?.fullName ?? b.candidateName,
      "fr"
    )
  );
});

export const getMissingMaires = cache(async function getMissingMaires() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  // Politicians with MAIRE mandate who are NOT in the candidacy list
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      slug: string;
      fullName: string;
      photoUrl: string | null;
      partyShortName: string | null;
      partyColor: string | null;
      mandateStartDate: string | null;
    }>
  >(Prisma.sql`
    SELECT p.id, p.slug, p."fullName", p."photoUrl",
           pa."shortName" as "partyShortName", pa.color as "partyColor",
           m."startDate"::text as "mandateStartDate"
    FROM "Politician" p
    JOIN "Mandate" m ON m."politicianId" = p.id AND m."isCurrent" = true AND m.type = 'MAIRE'
    LEFT JOIN "Party" pa ON pa.id = p."currentPartyId"
    WHERE NOT EXISTS (
      SELECT 1 FROM "Candidacy" c WHERE c."politicianId" = p.id AND c."electionId" = ${election.id}
    )
    ORDER BY p."fullName" ASC
  `);

  return rows;
});

export const getParityOutliers = cache(async function getParityOutliers() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return { best: [], worst: [] };

  // Best parity lists (closest to 50%)
  const best = await db.$queryRaw<
    Array<{
      listName: string;
      communeId: string;
      communeName: string;
      departmentCode: string;
      femaleRate: number;
      candidateCount: number;
    }>
  >(Prisma.sql`
    SELECT
      c."listName",
      co.id as "communeId",
      co.name as "communeName",
      co."departmentCode",
      COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0) as "femaleRate",
      COUNT(*)::int as "candidateCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${election.id} AND ca."gender" IS NOT NULL AND c."listName" IS NOT NULL
    GROUP BY c."listName", co.id, co.name, co."departmentCode"
    HAVING COUNT(*) >= 10
    ORDER BY ABS(0.5 - COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0)) ASC
    LIMIT 10
  `);

  // Worst parity lists (furthest from 50%)
  const worst = await db.$queryRaw<
    Array<{
      listName: string;
      communeId: string;
      communeName: string;
      departmentCode: string;
      femaleRate: number;
      candidateCount: number;
    }>
  >(Prisma.sql`
    SELECT
      c."listName",
      co.id as "communeId",
      co.name as "communeName",
      co."departmentCode",
      COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0) as "femaleRate",
      COUNT(*)::int as "candidateCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${election.id} AND ca."gender" IS NOT NULL AND c."listName" IS NOT NULL
    GROUP BY c."listName", co.id, co.name, co."departmentCode"
    HAVING COUNT(*) >= 10
    ORDER BY ABS(0.5 - COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0)) DESC
    LIMIT 10
  `);

  return { best, worst };
});

// ============================================
// Department intermediate page
// ============================================

export async function getDepartmentMunicipales(
  departmentCode: string,
  page: number = 1,
  pageSize: number = 50
) {
  "use cache";
  cacheTag("elections");
  cacheLife("minutes");

  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return null;

  const offset = (page - 1) * pageSize;

  // Communes with list counts + candidate counts + results, sorted by most contested
  const communes = await db.$queryRaw<
    Array<{
      id: string;
      name: string;
      population: number | null;
      listCount: number;
      candidateCount: number;
      maireName: string | null;
      maireGender: string | null;
      topPct: number | null;
      hasElected: boolean;
      winnerListName: string | null;
      winnerPct: number | null;
    }>
  >(Prisma.sql`
    SELECT
      co.id,
      co.name,
      co.population,
      COUNT(DISTINCT c."listName")::int AS "listCount",
      COUNT(c.id)::int AS "candidateCount",
      p."fullName" AS "maireName",
      p.civility AS "maireGender",
      MAX(c."round1Pct")::float AS "topPct",
      MAX(c."isElected"::int)::boolean AS "hasElected",
      MAX(CASE WHEN c."isElected" THEN c."listName" END) AS "winnerListName",
      MAX(CASE WHEN c."isElected" THEN c."round1Pct" END)::float AS "winnerPct"
    FROM "Commune" co
    INNER JOIN "Candidacy" c ON c."communeId" = co.id AND c."electionId" = ${election.id}
    LEFT JOIN "Mandate" m ON m."isCurrent" = true AND m.type = 'MAIRE'
    LEFT JOIN "MandateLocal" ml ON ml."mandateId" = m.id AND ml."communeId" = co.id
    LEFT JOIN "Politician" p ON p.id = m."politicianId"
    WHERE co."departmentCode" = ${departmentCode}
    GROUP BY co.id, co.name, co.population, p."fullName", p.civility
    HAVING COUNT(DISTINCT c."listName") > 0
    ORDER BY
      MAX(c."round1Votes") IS NOT NULL DESC,
      COUNT(DISTINCT c."listName") DESC,
      co.population DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  // Total communes with at least 1 list for pagination
  const [{ total }] = await db.$queryRaw<[{ total: number }]>(Prisma.sql`
    SELECT COUNT(*)::int AS total
    FROM (
      SELECT co.id
      FROM "Commune" co
      INNER JOIN "Candidacy" c ON c."communeId" = co.id AND c."electionId" = ${election.id}
      WHERE co."departmentCode" = ${departmentCode}
      GROUP BY co.id
      HAVING COUNT(DISTINCT c."listName") > 0
    ) sub
  `);

  // Department-level aggregate stats
  const [rawStats] = await db.$queryRaw<
    [{ totalCommunes: number; totalLists: number; avgCompetition: number; parityRate: number }]
  >(Prisma.sql`
    SELECT
      dept.total_communes::int AS "totalCommunes",
      dept.total_lists::int AS "totalLists",
      ROUND(dept.avg_competition, 2)::float AS "avgCompetition",
      parity.female_rate::float AS "parityRate"
    FROM (
      SELECT
        COUNT(DISTINCT co.id) AS total_communes,
        COUNT(DISTINCT c."listName") AS total_lists,
        AVG(sub.list_count) AS avg_competition
      FROM "Commune" co
      INNER JOIN "Candidacy" c ON c."communeId" = co.id AND c."electionId" = ${election.id}
      INNER JOIN (
        SELECT c2."communeId", COUNT(DISTINCT c2."listName") AS list_count
        FROM "Candidacy" c2
        INNER JOIN "Commune" co2 ON c2."communeId" = co2.id
        WHERE c2."electionId" = ${election.id} AND co2."departmentCode" = ${departmentCode}
        GROUP BY c2."communeId"
      ) sub ON sub."communeId" = co.id
      WHERE co."departmentCode" = ${departmentCode}
    ) dept,
    (
      SELECT
        CASE WHEN COUNT(*) = 0 THEN 0
        ELSE COUNT(*) FILTER (WHERE ca.gender = 'F')::float / COUNT(*)::float
        END AS female_rate
      FROM "Candidacy" c
      INNER JOIN "Commune" co ON c."communeId" = co.id
      INNER JOIN "Candidate" ca ON c."candidateId" = ca.id
      WHERE c."electionId" = ${election.id}
        AND co."departmentCode" = ${departmentCode}
        AND ca.gender IS NOT NULL
    ) parity
  `);

  const stats = rawStats ?? {
    totalCommunes: 0,
    totalLists: 0,
    avgCompetition: 0,
    parityRate: 0,
  };

  // Department participation (from CommuneElectionRound)
  const [deptParticipation] = await db.$queryRaw<
    [{ communesDepouillees: number; avgParticipation: number | null }]
  >(Prisma.sql`
    SELECT
      COUNT(*)::int AS "communesDepouillees",
      ROUND(AVG(cer."participationRate"), 2)::float AS "avgParticipation"
    FROM "CommuneElectionRound" cer
    INNER JOIN "Commune" co ON cer."communeId" = co.id
    WHERE cer."electionId" = ${election.id}
      AND cer.round = 1
      AND co."departmentCode" = ${departmentCode}
  `);

  return {
    communes,
    total,
    totalPages: Math.ceil(total / pageSize),
    stats,
    participation: deptParticipation ?? null,
  };
}

// ============================================
// Maires listing + stats
// ============================================

export interface MaireStats {
  total: number;
  femaleRate: number;
  withParty: number;
  withNationalMandate: number;
  partyDistribution: Array<{ shortName: string; color: string | null; count: number }>;
  mandateDistribution: Array<{ bracket: string; count: number }>;
}

/** Aggregated stats for all current maires — cached with tag */
export async function getMaireStats(): Promise<MaireStats> {
  "use cache";
  cacheTag("maires-stats", "elections");
  cacheLife("minutes");

  const [counts] = await db.$queryRaw<
    [{ total: number; female: number; with_party: number; with_national_mandate: number }]
  >(Prisma.sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE p.civility = 'Mme')::int as female,
      COUNT(*) FILTER (WHERE p."currentPartyId" IS NOT NULL)::int as with_party,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "Mandate" m2
        WHERE m2."politicianId" = m."politicianId"
          AND m2."isCurrent" = true
          AND m2.type IN ('DEPUTE', 'SENATEUR', 'DEPUTE_EUROPEEN', 'MINISTRE', 'SECRETAIRE_ETAT', 'PREMIER_MINISTRE', 'PRESIDENT_REPUBLIQUE')
          AND m2.id != m.id
      ))::int as with_national_mandate
    FROM "Mandate" m
    JOIN "MandateLocal" ml ON ml."mandateId" = m.id
    JOIN "Politician" p ON p.id = m."politicianId"
    WHERE m.type = 'MAIRE' AND m."isCurrent" = true
  `);

  const partyDistribution = await db.$queryRaw<
    Array<{ shortName: string; color: string | null; count: number }>
  >(Prisma.sql`
    SELECT pa."shortName", pa.color, COUNT(*)::int as count
    FROM "Mandate" m
    JOIN "MandateLocal" ml ON ml."mandateId" = m.id
    JOIN "Politician" p ON p.id = m."politicianId"
    JOIN "Party" pa ON pa.id = p."currentPartyId"
    WHERE m.type = 'MAIRE' AND m."isCurrent" = true AND p."currentPartyId" IS NOT NULL
    GROUP BY pa."shortName", pa.color
    ORDER BY count DESC
    LIMIT 15
  `);

  const mandateDistribution = await db.$queryRaw<
    Array<{ bracket: string; count: number }>
  >(Prisma.sql`
    SELECT
      CASE
        WHEN ml."functionStart" >= '2024-01-01' THEN 'Depuis 2024'
        WHEN ml."functionStart" >= '2020-01-01' THEN 'Depuis 2020'
        WHEN ml."functionStart" >= '2014-01-01' THEN 'Depuis 2014'
        WHEN ml."functionStart" IS NOT NULL THEN 'Avant 2014'
        ELSE 'Non renseigné'
      END as bracket,
      COUNT(*)::int as count
    FROM "Mandate" m
    JOIN "MandateLocal" ml ON ml."mandateId" = m.id
    WHERE m.type = 'MAIRE' AND m."isCurrent" = true
    GROUP BY bracket
    ORDER BY MIN(COALESCE(ml."functionStart", '1900-01-01'))
  `);

  return {
    total: counts.total,
    femaleRate: counts.total > 0 ? counts.female / counts.total : 0,
    withParty: counts.with_party,
    withNationalMandate: counts.with_national_mandate,
    partyDistribution,
    mandateDistribution,
  };
}

/** Core query for maires listing — used by both cached and uncached paths */
async function queryMaires(
  search?: string,
  departmentCode?: string,
  partyId?: string,
  gender?: string,
  page = 1
) {
  const limit = 50;
  const skip = (page - 1) * limit;

  const where: Prisma.MandateWhereInput = {
    type: "MAIRE",
    isCurrent: true,
    ...(departmentCode ? { departmentCode } : {}),
    politician: {
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(partyId ? { currentPartyId: partyId } : {}),
      ...(gender ? { civility: gender === "F" ? "Mme" : "M." } : {}),
    },
  };

  const [mandates, total] = await Promise.all([
    db.mandate.findMany({
      where,
      include: {
        politician: {
          select: {
            slug: true,
            fullName: true,
            firstName: true,
            lastName: true,
            civility: true,
            photoUrl: true,
            blobPhotoUrl: true,
            birthDate: true,
            currentParty: { select: { shortName: true, color: true, slug: true } },
          },
        },
        localData: {
          include: {
            commune: { select: { name: true, departmentCode: true, population: true } },
          },
        },
      },
      orderBy: { politician: { lastName: "asc" } },
      skip,
      take: limit,
    }),
    db.mandate.count({ where }),
  ]);

  // Normalize to a flat shape compatible with MaireCard.
  // civility "Mme"/"M." is mapped to legacy "F"/"M" gender values.
  const maires = mandates.map((m) => ({
    id: m.id,
    fullName: m.politician.fullName,
    gender: m.politician.civility === "Mme" ? "F" : "M",
    departmentCode: m.departmentCode ?? m.localData?.commune?.departmentCode ?? "",
    functionStart: m.localData?.functionStart ?? null,
    mandateStart: m.startDate,
    party: m.politician.currentParty,
    politician: {
      slug: m.politician.slug,
      fullName: m.politician.fullName,
      photoUrl: m.politician.photoUrl,
    },
    commune: m.localData?.commune ?? null,
  }));

  return {
    maires,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/** Cached path — bounded key space (enums + page, no free-text) */
export async function getMairesFiltered(
  departmentCode?: string,
  partyId?: string,
  gender?: string,
  page = 1
) {
  "use cache";
  cacheTag("maires-listing", "elections");
  cacheLife("minutes");
  return queryMaires(undefined, departmentCode, partyId, gender, page);
}

/** Uncached path — free-text search */
export async function searchMaires(
  search: string,
  departmentCode?: string,
  partyId?: string,
  gender?: string,
  page = 1
) {
  return queryMaires(search, departmentCode, partyId, gender, page);
}

/** Router: cached when no search, uncached when searching */
export async function getMaires(
  search?: string,
  departmentCode?: string,
  partyId?: string,
  gender?: string,
  page = 1
) {
  if (search) {
    return searchMaires(search, departmentCode, partyId, gender, page);
  }
  return getMairesFiltered(departmentCode, partyId, gender, page);
}

/** Get parties that have at least one maire (for filter dropdown) */
export async function getMaireParties() {
  "use cache";
  cacheTag("maires-listing", "elections");
  cacheLife("minutes");

  return db.$queryRaw<Array<{ id: string; shortName: string; color: string | null }>>(
    Prisma.sql`
      SELECT DISTINCT pa.id, pa."shortName", pa.color
      FROM "Party" pa
      JOIN "Politician" p ON p."currentPartyId" = pa.id
      JOIN "Mandate" m ON m."politicianId" = p.id AND m.type = 'MAIRE' AND m."isCurrent" = true
      JOIN "MandateLocal" ml ON ml."mandateId" = m.id
      ORDER BY pa."shortName" ASC
    `
  );
}

// ============================================
// Municipales 2020 — Historical data
// ============================================

export interface Historique2020 {
  participationT1: number;
  registeredVoters: number;
  winningList: {
    name: string;
    nuance: string | null;
    pct: number;
    seatsWon: number | null;
  };
  totalLists: number;
  hadSecondRound: boolean;
  participationT2: number | null;
  electedMayor: { fullName: string; gender: string | null } | null;
}

export const getCommuneHistorique2020 = cache(async function getCommuneHistorique2020(
  inseeCode: string
): Promise<Historique2020 | null> {
  // 1. Find election
  const election = await db.election.findUnique({
    where: { slug: "municipales-2020" },
    select: { id: true },
  });
  if (!election) return null;

  // 2. Count lists for this commune
  const listCount = await db.candidacy.count({
    where: { electionId: election.id, communeId: inseeCode },
  });
  if (listCount === 0) return null;

  // 3. Find winning list — order by isElected desc, then round1Pct desc
  const topList = await db.candidacy.findFirst({
    where: { electionId: election.id, communeId: inseeCode },
    orderBy: [{ isElected: "desc" }, { round1Pct: "desc" }],
    select: {
      candidateName: true,
      listName: true,
      partyLabel: true,
      round1Pct: true,
      round1Qualified: true,
      isElected: true,
    },
  });
  if (!topList) return null;

  // 4. Check if T2 occurred for this commune
  const t2Count = await db.candidacy.count({
    where: {
      electionId: election.id,
      communeId: inseeCode,
      round2Votes: { not: null },
    },
  });
  const hadSecondRound = t2Count > 0;

  // 5. Get T1 participation from ElectionRound (national level)
  const round1 = await db.electionRound.findUnique({
    where: { electionId_round: { electionId: election.id, round: 1 } },
    select: { participationRate: true, registeredVoters: true },
  });

  // 6. Get T2 participation if applicable
  let participationT2: number | null = null;
  if (hadSecondRound) {
    const round2 = await db.electionRound.findUnique({
      where: { electionId_round: { electionId: election.id, round: 2 } },
      select: { participationRate: true },
    });
    participationT2 = round2?.participationRate ? Number(round2.participationRate) : null;
  }

  // 7. Find elected mayor
  const electedMayor = await db.candidacy.findFirst({
    where: {
      electionId: election.id,
      communeId: inseeCode,
      isElected: true,
    },
    orderBy: { round1Pct: "desc" },
    select: { candidateName: true },
  });

  return {
    participationT1: round1?.participationRate ? Number(round1.participationRate) : 0,
    registeredVoters: round1?.registeredVoters ?? 0,
    winningList: {
      name: topList.listName ?? topList.candidateName,
      nuance: topList.partyLabel,
      pct: topList.round1Pct ? Number(topList.round1Pct) : 0,
      seatsWon: null,
    },
    totalLists: listCount,
    hadSecondRound,
    participationT2,
    electedMayor: electedMayor ? { fullName: electedMayor.candidateName, gender: null } : null,
  };
});
