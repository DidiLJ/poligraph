import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Chamber, VotingResult, ThemeCategory, ScrutinType } from "@/generated/prisma";
import { KEY_VOTES_HUB_WINDOW_DAYS, KEY_VOTES_GRID_COUNT } from "@/config/scrutin-importance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyScrutin {
  id: string;
  externalId: string;
  slug: string | null;
  title: string;
  votingDate: Date;
  legislature: number;
  chamber: Chamber;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
  sourceUrl: string | null;
  theme: ThemeCategory | null;
  type: ScrutinType | null;
  summary: string | null;
}

export interface DailyVotesData {
  scrutins: DailyScrutin[];
  grouped: Record<Chamber, DailyScrutin[]>;
  total: number;
  adopted: number;
  rejected: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get today's date string in Paris timezone (YYYY-MM-DD). */
export function getParisToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

/** Parse a YYYY-MM-DD string into a UTC start-of-day Date. */
function parseDateRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(dateStr + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

const DAILY_SELECT = {
  id: true,
  externalId: true,
  slug: true,
  title: true,
  votingDate: true,
  legislature: true,
  chamber: true,
  votesFor: true,
  votesAgainst: true,
  votesAbstain: true,
  result: true,
  sourceUrl: true,
  theme: true,
  type: true,
  summary: true,
} as const;

// ---------------------------------------------------------------------------
// Data functions
// ---------------------------------------------------------------------------

/**
 * Get all scrutins for a given date, grouped by chamber.
 * Bounded key space (date string only) → safe for "use cache".
 */
export async function getScrutinsByDate(dateStr: string): Promise<DailyVotesData> {
  "use cache";
  cacheTag("votes", "votes-daily");
  cacheLife("minutes");

  const { start, end } = parseDateRange(dateStr);

  const scrutins = await db.scrutin.findMany({
    where: { votingDate: { gte: start, lt: end } },
    orderBy: { votingDate: "desc" },
    select: DAILY_SELECT,
  });

  const grouped: Record<Chamber, DailyScrutin[]> = { AN: [], SENAT: [] };
  let adopted = 0;
  let rejected = 0;

  for (const s of scrutins) {
    grouped[s.chamber].push(s);
    if (s.result === "ADOPTED") adopted++;
    else rejected++;
  }

  return { scrutins, grouped, total: scrutins.length, adopted, rejected };
}

/**
 * Find the nearest dates with votes before/after a given date.
 * Used for prev/next navigation.
 */
export async function getAdjacentVoteDates(
  dateStr: string
): Promise<{ prevDate: string | null; nextDate: string | null }> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const { start, end } = parseDateRange(dateStr);

  const [prev, next] = await Promise.all([
    db.scrutin.findFirst({
      where: { votingDate: { lt: start } },
      orderBy: { votingDate: "desc" },
      select: { votingDate: true },
    }),
    db.scrutin.findFirst({
      where: { votingDate: { gte: end } },
      orderBy: { votingDate: "asc" },
      select: { votingDate: true },
    }),
  ]);

  return {
    prevDate: prev ? prev.votingDate.toISOString().split("T")[0]! : null,
    nextDate: next ? next.votingDate.toISOString().split("T")[0]! : null,
  };
}

/**
 * Get today's vote summary for the homepage widget.
 */
export async function getTodayVotesSummary(): Promise<{
  total: number;
  adopted: number;
  rejected: number;
  date: string;
}> {
  "use cache";
  cacheTag("votes", "homepage");
  cacheLife("minutes");

  const dateStr = getParisToday();
  const { start, end } = parseDateRange(dateStr);

  const results = await db.scrutin.groupBy({
    by: ["result"],
    where: { votingDate: { gte: start, lt: end } },
    _count: true,
  });

  const adopted = results.find((r) => r.result === "ADOPTED")?._count ?? 0;
  const rejected = results.find((r) => r.result === "REJECTED")?._count ?? 0;

  return { total: adopted + rejected, adopted, rejected, date: dateStr };
}

// ---------------------------------------------------------------------------
// Votes listing page — data functions
// ---------------------------------------------------------------------------

/** Core query logic shared by cached and uncached paths. */
async function queryScrutins(params: {
  page: number;
  limit: number;
  result?: VotingResult;
  legislature?: number;
  chamber?: Chamber;
  theme?: ThemeCategory;
  type?: ScrutinType;
  excludeType?: ScrutinType;
  search?: string;
}) {
  const { page, limit, result, legislature, chamber, theme, type, excludeType, search } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(result && { result }),
    ...(legislature && { legislature }),
    ...(chamber && { chamber }),
    ...(theme && { theme }),
    ...(type && { type }),
    ...(excludeType && { type: { not: excludeType } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { summary: { contains: search, mode: "insensitive" as const } },
        { citizenImpact: { contains: search, mode: "insensitive" as const } },
        {
          dossierLegislatif: {
            title: { contains: search, mode: "insensitive" as const },
          },
        },
      ],
    }),
  };

  const [scrutins, total, stats] = await Promise.all([
    db.scrutin.findMany({
      where,
      orderBy: { votingDate: "desc" },
      skip,
      take: limit,
      select: {
        ...DAILY_SELECT,
        dossierLegislatif: { select: { title: true, slug: true } },
      },
    }),
    db.scrutin.count({ where }),
    db.scrutin.groupBy({
      by: ["result"],
      where,
      _count: true,
    }),
  ]);

  return {
    scrutins,
    total,
    totalPages: Math.ceil(total / limit),
    stats: stats.reduce(
      (acc, s) => {
        acc[s.result] = s._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}

/** Cached path — bounded key space (enums + page, no free-text search). */
async function getScrutinsFiltered(params: {
  page: number;
  limit: number;
  result?: VotingResult;
  legislature?: number;
  chamber?: Chamber;
  theme?: ThemeCategory;
  type?: ScrutinType;
  excludeType?: ScrutinType;
}) {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");
  return queryScrutins(params);
}

/** Router: use cached path when no search, uncached when searching. */
export async function getScrutins(params: {
  page: number;
  limit: number;
  result?: VotingResult;
  legislature?: number;
  chamber?: Chamber;
  theme?: ThemeCategory;
  type?: ScrutinType;
  excludeType?: ScrutinType;
  search?: string;
}) {
  if (params.search) {
    return queryScrutins(params);
  }
  return getScrutinsFiltered(params);
}

export async function getLegislatures() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutin.groupBy({
    by: ["legislature"],
    _count: true,
    orderBy: { legislature: "desc" },
  });
}

export async function getChambers() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutin.groupBy({
    by: ["chamber"],
    _count: true,
  });
}

export async function getThemeCounts() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const counts = await db.scrutin.groupBy({
    by: ["theme"],
    _count: true,
    orderBy: { _count: { theme: "desc" } },
  });
  return counts.filter((c) => c.theme !== null) as { theme: ThemeCategory; _count: number }[];
}

export async function getTypeCounts() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutin.groupBy({
    by: ["type"],
    _count: true,
  });
}

/** Theme counts including key vote counts for the hub. */
export async function getThemeCountsWithKeyVotes() {
  "use cache";
  cacheTag("votes", "votes-key");
  cacheLife("minutes");

  const [allCounts, keyCounts] = await Promise.all([
    db.scrutin.groupBy({
      by: ["theme"],
      _count: true,
      orderBy: { _count: { theme: "desc" } },
    }),
    db.scrutin.groupBy({
      by: ["theme"],
      where: { importance: { isKeyVote: true } },
      _count: true,
    }),
  ]);

  const keyMap = new Map(keyCounts.filter((c) => c.theme).map((c) => [c.theme!, c._count]));

  return allCounts
    .filter((c) => c.theme !== null)
    .map((c) => ({
      theme: c.theme!,
      total: c._count,
      keyVotes: keyMap.get(c.theme!) ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Hub page — data functions
// ---------------------------------------------------------------------------

/** Last scrutin date, used for parliamentary recess banner. */
export async function getLastScrutinDate(): Promise<Date | null> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const last = await db.scrutin.findFirst({
    orderBy: { votingDate: "desc" },
    select: { votingDate: true },
  });
  return last?.votingDate ?? null;
}

/** 8 most recent scrutins for the hub page hero section. */
export async function getLatestScrutins() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutin.findMany({
    orderBy: { votingDate: "desc" },
    take: 8,
    select: DAILY_SELECT,
  });
}

/** Today's vote counts by chamber. */
export async function getTodayVotesByChamber(): Promise<{
  AN: number;
  SENAT: number;
  total: number;
  date: string;
}> {
  "use cache";
  cacheTag("votes", "votes-daily");
  cacheLife("minutes");

  const dateStr = getParisToday();
  const { start, end } = parseDateRange(dateStr);

  const results = await db.scrutin.groupBy({
    by: ["chamber"],
    where: { votingDate: { gte: start, lt: end } },
    _count: true,
  });

  const AN = results.find((r) => r.chamber === "AN")?._count ?? 0;
  const SENAT = results.find((r) => r.chamber === "SENAT")?._count ?? 0;

  return { AN, SENAT, total: AN + SENAT, date: dateStr };
}

/** Aggregate stats for the hub page: total scrutins + total dossiers. */
export async function getHubStats(): Promise<{
  totalScrutins: number;
  totalDossiers: number;
}> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const [totalScrutins, totalDossiers] = await Promise.all([
    db.scrutin.count(),
    db.legislativeDossier.count(),
  ]);

  return { totalScrutins, totalDossiers };
}

/** Per-chamber vote count and adoption rate. */
export async function getChamberAdoptionRates(): Promise<
  Array<{
    chamber: Chamber;
    total: number;
    adopted: number;
    adoptionRate: number;
  }>
> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const results = await db.scrutin.groupBy({
    by: ["chamber", "result"],
    _count: true,
  });

  const byC = new Map<Chamber, { total: number; adopted: number }>();

  for (const r of results) {
    const entry = byC.get(r.chamber) ?? { total: 0, adopted: 0 };
    entry.total += r._count;
    if (r.result === "ADOPTED") entry.adopted += r._count;
    byC.set(r.chamber, entry);
  }

  return Array.from(byC.entries()).map(([chamber, { total, adopted }]) => ({
    chamber,
    total,
    adopted,
    adoptionRate: total > 0 ? Math.round((adopted / total) * 100) : 0,
  }));
}

// ---------------------------------------------------------------------------
// Key votes (parlement-riche hub)
// ---------------------------------------------------------------------------

/** Key votes from last N days for the hub hero + grid. */
export async function getKeyVotes(): Promise<{
  hero: (DailyScrutin & { score: number }) | null;
  grid: Array<DailyScrutin & { score: number }>;
}> {
  "use cache";
  cacheTag("votes", "votes-key");
  cacheLife("minutes");

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - KEY_VOTES_HUB_WINDOW_DAYS);

  const keyVotes = await db.scrutin.findMany({
    where: {
      importance: { isKeyVote: true },
      votingDate: { gte: windowStart },
    },
    orderBy: [{ votingDate: "desc" }, { importance: { score: "desc" } }],
    take: KEY_VOTES_GRID_COUNT + 1,
    select: {
      ...DAILY_SELECT,
      importance: { select: { score: true } },
    },
  });

  if (keyVotes.length === 0) {
    const fallback = await db.scrutin.findMany({
      where: {
        importance: { isNot: null },
        votingDate: { gte: windowStart },
      },
      orderBy: { importance: { score: "desc" } },
      take: KEY_VOTES_GRID_COUNT + 1,
      select: {
        ...DAILY_SELECT,
        importance: { select: { score: true } },
      },
    });

    const mapped = fallback.map((s) => ({
      ...s,
      score: s.importance?.score ?? 0,
    }));

    return { hero: mapped[0] ?? null, grid: mapped.slice(1) };
  }

  const mapped = keyVotes.map((s) => ({
    ...s,
    score: s.importance?.score ?? 0,
  }));

  return { hero: mapped[0] ?? null, grid: mapped.slice(1) };
}
