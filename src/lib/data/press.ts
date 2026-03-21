import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

// ── Types ────────────────────────────────────────────────────

interface PressQueryParams {
  page: number;
  limit: number;
  source?: string;
  partyId?: string;
  search?: string;
  sort?: string;
}

// ── Core query (free-text capable, never cached directly) ───

async function queryPress(params: PressQueryParams) {
  const { page, limit, source, partyId, search, sort } = params;
  const skip = (page - 1) * limit;

  const where = {
    OR: [{ mentions: { some: {} } }, { partyMentions: { some: {} } }],
    ...(source && { feedSource: source }),
    ...(partyId && { partyMentions: { some: { partyId } } }),
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [articles, total] = await Promise.all([
    db.pressArticle.findMany({
      where,
      orderBy: sort === "relevance" ? { mentions: { _count: "desc" } } : { publishedAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: { select: { mentions: true } },
        mentions: {
          include: {
            politician: {
              select: { slug: true, fullName: true },
            },
          },
        },
        partyMentions: {
          include: {
            party: {
              select: { slug: true, name: true, shortName: true, color: true },
            },
          },
        },
      },
    }),
    db.pressArticle.count({ where }),
  ]);

  return { articles, total, totalPages: Math.ceil(total / limit) };
}

// ── Cached path (bounded params) ────────────────────────────

export async function getPressFiltered(params: Omit<PressQueryParams, "search">) {
  "use cache";
  cacheTag("press");
  cacheLife("minutes");
  return queryPress(params);
}

// ── Uncached path (free-text search) ────────────────────────

export async function searchPress(params: PressQueryParams) {
  return queryPress(params);
}

// ── Router ──────────────────────────────────────────────────

export async function getPress(params: PressQueryParams) {
  if (params.search) return searchPress(params);
  return getPressFiltered(params);
}

// ── Stats ───────────────────────────────────────────────────

export async function getPressStats() {
  "use cache";
  cacheTag("press");
  cacheLife("minutes");

  const linkedFilter = {
    OR: [{ mentions: { some: {} } }, { partyMentions: { some: {} } }],
  };

  const [totalArticles, bySource, totalMentions, totalPartyMentions] = await Promise.all([
    db.pressArticle.count({ where: linkedFilter }),
    db.pressArticle.groupBy({
      by: ["feedSource"],
      where: linkedFilter,
      _count: true,
    }),
    db.pressArticleMention.count(),
    db.pressArticlePartyMention.count(),
  ]);

  return {
    totalArticles,
    bySource: bySource.reduce(
      (acc, s) => {
        acc[s.feedSource] = s._count;
        return acc;
      },
      {} as Record<string, number>
    ),
    totalMentions,
    totalPartyMentions,
  };
}

// ── Party filter data ───────────────────────────────────────

export async function getPartiesWithPressMentions() {
  "use cache";
  cacheTag("press", "parties");
  cacheLife("minutes");

  return db.party.findMany({
    where: { pressMentions: { some: {} } },
    select: {
      id: true,
      name: true,
      shortName: true,
      color: true,
      _count: { select: { pressMentions: true } },
    },
    orderBy: { pressMentions: { _count: "desc" } },
    take: 20,
  });
}
