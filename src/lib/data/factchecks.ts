import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";
import { factcheckStatsService } from "@/services/factcheckStats";
import type { FactCheckRating } from "@/types";

/** Generic claimant patterns — must match GENERIC_CLAIMANT_PATTERNS in labels.ts */
const GENERIC_CLAIMANT_PATTERNS = [
  "réseaux sociaux",
  "sources multiples",
  "sites internet",
  "publications",
  "utilisateurs",
  "internautes",
  "viral",
  "facebook",
  "twitter",
  "tiktok",
  "whatsapp",
  "telegram",
  "youtube",
  "instagram",
  "chaîne de mails",
  "rumeur",
  "blog",
  "forum",
];

/** Super-category groups for verdict filtering. */
const VERDICT_GROUPS: Record<string, FactCheckRating[]> = {
  faux: ["FALSE", "MOSTLY_FALSE"],
  trompeur: ["MISLEADING", "OUT_OF_CONTEXT", "HALF_TRUE"],
  vrai: ["TRUE", "MOSTLY_TRUE"],
};

function buildVerdictFilter(verdict: string) {
  const group = VERDICT_GROUPS[verdict];
  if (group) {
    return { verdictRating: { in: group } };
  }
  return { verdictRating: verdict as FactCheckRating };
}

function buildDirectClaimFilter() {
  return {
    claimant: { not: null },
    NOT: GENERIC_CLAIMANT_PATTERNS.map((pattern) => ({
      claimant: { contains: pattern, mode: "insensitive" as const },
    })),
  };
}

/**
 * Fetch paginated fact-checks with filters.
 * Routes to cached path (bounded params) or uncached (free-text search).
 */
export async function getFactchecks(params: {
  page: number;
  limit: number;
  source?: string;
  verdict?: string;
  politicianSlug?: string;
  search?: string;
  directOnly?: boolean;
}) {
  if (params.search) {
    return queryFactchecks(params);
  }
  return getFactchecksFiltered(
    params.page,
    params.limit,
    params.source ?? "",
    params.verdict ?? "",
    params.politicianSlug ?? "",
    params.directOnly ?? false
  );
}

/** Cached path — bounded params only (no free-text search). */
async function getFactchecksFiltered(
  page: number,
  limit: number,
  source: string,
  verdict: string,
  politicianSlug: string,
  directOnly: boolean
) {
  "use cache";
  cacheTag("factchecks");
  cacheLife("minutes");
  return queryFactchecks({
    page,
    limit,
    source: source || undefined,
    verdict: verdict || undefined,
    politicianSlug: politicianSlug || undefined,
    directOnly: directOnly || undefined,
  });
}

/** Uncached query — shared implementation. */
async function queryFactchecks(params: {
  page: number;
  limit: number;
  source?: string;
  verdict?: string;
  politicianSlug?: string;
  search?: string;
  directOnly?: boolean;
}) {
  const { page, limit, source, verdict, politicianSlug, search, directOnly } = params;
  const skip = (page - 1) * limit;

  const where = {
    publicationStatus: "PUBLISHED" as const,
    source: source || { in: FACTCHECK_ALLOWED_SOURCES },
    ...(verdict && buildVerdictFilter(verdict)),
    ...(politicianSlug && {
      mentions: {
        some: {
          politician: { slug: politicianSlug },
        },
      },
    }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { claimText: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(directOnly && buildDirectClaimFilter()),
  };

  const [factChecks, total] = await Promise.all([
    db.factCheck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        mentions: {
          select: {
            isClaimant: true,
            politician: {
              select: { slug: true, fullName: true },
            },
          },
        },
      },
    }),
    db.factCheck.count({ where }),
  ]);

  return {
    factChecks,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Aggregated page stats (total, by rating, top politicians) — cached.
 */
export async function getFactcheckStats() {
  "use cache";
  cacheTag("factchecks");
  cacheLife("minutes");

  return factcheckStatsService.getPageStats();
}

/**
 * Distinct sources with counts — cached.
 */
export async function getFactcheckSources() {
  "use cache";
  cacheTag("factchecks");
  cacheLife("minutes");

  const sources = await db.factCheck.groupBy({
    by: ["source"],
    where: {
      publicationStatus: "PUBLISHED",
      source: { in: FACTCHECK_ALLOWED_SOURCES },
    },
    _count: true,
    orderBy: { _count: { source: "desc" } },
  });
  return sources.map((s) => ({ name: s.source, count: s._count }));
}

/**
 * Resolve politician full name from slug (for filter badge display).
 */
export async function getPoliticianNameBySlug(slug: string): Promise<string | null> {
  const p = await db.politician.findUnique({
    where: { slug },
    select: { fullName: true },
  });
  return p?.fullName || null;
}
