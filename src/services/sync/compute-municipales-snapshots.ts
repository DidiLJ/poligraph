import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import {
  MUNICIPALES_SNAPSHOT_KEYS,
  type ParityOutliers,
  type ParityBySize,
  type DeptPartyData,
} from "@/types/stats-snapshots";

/**
 * Compute the four heavy municipales-2026 aggregations and upsert into StatsSnapshot.
 *
 * Called by:
 *   - npm run sync:municipales-snapshots (CLI)
 *   - Inngest cron (sync-daily DAILY_STEPS)
 *   - Inngest manual trigger (admin /syncs page)
 *
 * Idempotent. Safe to run concurrently — the upsert key prevents duplicates.
 */
export async function computeMunicipalesSnapshots(): Promise<{
  ok: true;
  computed: string[];
  totalDurationMs: number;
}> {
  const t0 = Date.now();
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) {
    throw new Error("Election municipales-2026 not found — cannot compute snapshots");
  }

  const computed: string[] = [];

  // ─── 1. Parity outliers (best + worst combined) ─────────
  await runAndUpsert(
    MUNICIPALES_SNAPSHOT_KEYS.parityOutliers,
    () => computeParityOutliersLive(election.id),
    computed
  );

  // ─── 2. Parity by population bracket ────────────────────
  await runAndUpsert(
    MUNICIPALES_SNAPSHOT_KEYS.parityBySize,
    () => computeParityBySizeLive(election.id),
    computed
  );

  // ─── 3. Department × party counts ───────────────────────
  await runAndUpsert(
    MUNICIPALES_SNAPSHOT_KEYS.deptParty,
    () => computeDepartmentPartyDataLive(election.id),
    computed
  );

  return { ok: true, computed, totalDurationMs: Date.now() - t0 };
}

async function runAndUpsert<T>(
  key: string,
  fn: () => Promise<T>,
  computed: string[]
): Promise<void> {
  const t0 = Date.now();
  const data = await fn();
  const durationMs = Date.now() - t0;
  await db.statsSnapshot.upsert({
    where: { key },
    create: { key, data: data as Prisma.InputJsonValue, durationMs },
    update: { data: data as Prisma.InputJsonValue, durationMs, computedAt: new Date() },
  });
  computed.push(`${key} (${durationMs}ms)`);
  console.log(`  [snapshot] ${key} -> ${durationMs}ms`);
}

// ─── Live computers (also exported for fallback in src/lib/data/municipales.ts) ──

export async function computeParityOutliersLive(electionId: string): Promise<ParityOutliers> {
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
    WHERE c."electionId" = ${electionId} AND ca."gender" IS NOT NULL AND c."listName" IS NOT NULL
    GROUP BY c."listName", co.id, co.name, co."departmentCode"
    HAVING COUNT(*) >= 10
    ORDER BY ABS(0.5 - COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0)) ASC
    LIMIT 10
  `);

  const worst = await db.$queryRaw<typeof best>(Prisma.sql`
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
    WHERE c."electionId" = ${electionId} AND ca."gender" IS NOT NULL AND c."listName" IS NOT NULL
    GROUP BY c."listName", co.id, co.name, co."departmentCode"
    HAVING COUNT(*) >= 10
    ORDER BY ABS(0.5 - COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0)) DESC
    LIMIT 10
  `);

  return { best, worst };
}

export async function computeParityBySizeLive(electionId: string): Promise<ParityBySize> {
  const rows = await db.$queryRaw<
    Array<{ bracket: string; femaleCount: number; totalCount: number }>
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
    WHERE c."electionId" = ${electionId}
      AND ca."gender" IS NOT NULL AND co.population IS NOT NULL
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
}

export async function computeDepartmentPartyDataLive(electionId: string): Promise<DeptPartyData> {
  const rows = await db.$queryRaw<
    Array<{
      departmentCode: string;
      departmentName: string;
      partyLabel: string;
      listCount: number;
    }>
  >(Prisma.sql`
    SELECT co."departmentCode", co."departmentName", c."partyLabel",
           COUNT(DISTINCT c."listName")::int as "listCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    WHERE c."electionId" = ${electionId} AND c."partyLabel" IS NOT NULL
    GROUP BY co."departmentCode", co."departmentName", c."partyLabel"
    ORDER BY co."departmentCode", "listCount" DESC
  `);

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
    dominantParty: dept.parties[0]?.label ?? null,
  }));
}
