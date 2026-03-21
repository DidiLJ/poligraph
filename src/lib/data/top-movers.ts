import "server-only";
import { db } from "@/lib/db";
import { cacheTag, cacheLife } from "next/cache";
import { FACTCHECK_RATING_LABELS } from "@/config/labels";
import type { FactCheckRating } from "@/generated/prisma";

export interface TopMoverPolitician {
  slug: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  currentParty: { shortName: string; color: string | null } | null;
}

export interface TopMoverItem {
  politician: TopMoverPolitician;
  reason: string;
  type: "affair" | "factcheck";
  href: string;
}

const POLITICIAN_SELECT = {
  slug: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  currentParty: { select: { shortName: true, color: true } },
} as const;

/**
 * Merge two sources, deduplicate by politician slug, take first 4.
 * Exported for testing.
 */
export function mergeAndDedupe(
  affairs: TopMoverItem[],
  factchecks: TopMoverItem[]
): TopMoverItem[] {
  const merged = [...affairs, ...factchecks];
  const seen = new Set<string>();
  const result: TopMoverItem[] = [];

  for (const item of merged) {
    if (seen.has(item.politician.slug)) continue;
    seen.add(item.politician.slug);
    result.push(item);
    if (result.length >= 4) break;
  }

  return result;
}

export async function getTopMovers(): Promise<TopMoverItem[]> {
  "use cache";
  cacheTag("politicians");
  cacheLife("minutes");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [recentAffairs, recentFactchecks] = await Promise.all([
    db.affair.findMany({
      where: {
        createdAt: { gte: weekAgo },
        publicationStatus: "PUBLISHED",
        involvement: "DIRECT",
      },
      select: { politician: { select: POLITICIAN_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    db.factCheck.findMany({
      where: {
        createdAt: { gte: weekAgo },
        publicationStatus: "PUBLISHED",
      },
      select: {
        verdictRating: true,
        mentions: {
          select: {
            politician: { select: POLITICIAN_SELECT },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
  ]);

  const affairItems: TopMoverItem[] = recentAffairs.map((a) => ({
    politician: a.politician,
    reason: "Nouvelle affaire documentée",
    type: "affair" as const,
    href: `/politiques/${a.politician.slug}`,
  }));

  const factcheckItems: TopMoverItem[] = recentFactchecks
    .filter((fc) => fc.mentions.length > 0)
    .map((fc) => {
      const mention = fc.mentions[0]!;
      const label = FACTCHECK_RATING_LABELS[fc.verdictRating as FactCheckRating];
      return {
        politician: mention.politician,
        reason: `Fact-check récent : ${label}`,
        type: "factcheck" as const,
        href: `/politiques/${mention.politician.slug}`,
      };
    });

  return mergeAndDedupe(affairItems, factcheckItems);
}
