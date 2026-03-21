import "server-only";
import { db } from "@/lib/db";
import { cacheTag, cacheLife } from "next/cache";

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
  type: "affair" | "factcheck" | "participation";
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
 * Merge three sources, deduplicate by politician slug, take first 4.
 * Exported for testing.
 */
export function mergeAndDedupe(
  affairs: TopMoverItem[],
  factchecks: TopMoverItem[],
  participation: TopMoverItem[]
): TopMoverItem[] {
  const merged = [...affairs, ...factchecks, ...participation];
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

  const [recentAffairs, recentFactchecks, lowParticipation] = await Promise.all([
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
    db.politicianParticipation.findMany({
      orderBy: { participationRate: "asc" },
      take: 2,
      select: {
        participationRate: true,
        slug: true,
        firstName: true,
        lastName: true,
      },
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
    .map((fc) => ({
      politician: fc.mentions[0].politician,
      reason: `Fact-check récent : ${fc.verdictRating}`,
      type: "factcheck" as const,
      href: `/politiques/${fc.mentions[0].politician.slug}`,
    }));

  const participationSlugs = lowParticipation.map((p) => p.slug);
  const participationPoliticians =
    participationSlugs.length > 0
      ? await db.politician.findMany({
          where: { slug: { in: participationSlugs }, publicationStatus: "PUBLISHED" },
          select: POLITICIAN_SELECT,
        })
      : [];
  const politicianBySlug = new Map(participationPoliticians.map((p) => [p.slug, p]));

  const participationItems: TopMoverItem[] = lowParticipation
    .filter((p) => politicianBySlug.has(p.slug))
    .map((p) => ({
      politician: politicianBySlug.get(p.slug)!,
      reason: `Taux de participation : ${Math.round(p.participationRate)}%`,
      type: "participation" as const,
      href: `/politiques/${p.slug}`,
    }));

  return mergeAndDedupe(affairItems, factcheckItems, participationItems);
}
