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
  type: "affair" | "factcheck" | "mandate" | "election" | "party";
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
 * Merge sources in priority order, deduplicate by politician slug, take first 4.
 * Sources passed first have higher priority.
 * Exported for testing.
 */
export function mergeAndDedupe(...sources: TopMoverItem[][]): TopMoverItem[] {
  const seen = new Set<string>();
  const result: TopMoverItem[] = [];

  for (const source of sources) {
    for (const item of source) {
      if (seen.has(item.politician.slug)) continue;
      seen.add(item.politician.slug);
      result.push(item);
      if (result.length >= 4) return result;
    }
  }

  return result;
}

export async function getTopMovers(): Promise<TopMoverItem[]> {
  "use cache";
  cacheTag("politicians");
  cacheLife("minutes");

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [recentAffairs, recentFactchecks, recentMandates, recentElections, recentPartyChanges] =
    await Promise.all([
      db.affair.findMany({
        where: {
          createdAt: { gte: twoWeeksAgo },
          publicationStatus: "PUBLISHED",
          involvement: "DIRECT",
        },
        select: { politician: { select: POLITICIAN_SELECT } },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
      db.factCheck.findMany({
        where: {
          createdAt: { gte: twoWeeksAgo },
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
      db.mandate.findMany({
        where: {
          startDate: { gte: twoWeeksAgo },
          isCurrent: true,
          politician: { publicationStatus: "PUBLISHED" },
        },
        select: {
          title: true,
          politician: { select: POLITICIAN_SELECT },
        },
        orderBy: { startDate: "desc" },
        take: 2,
      }),
      db.candidacy.findMany({
        where: {
          isElected: true,
          politicianId: { not: null },
          politician: { publicationStatus: "PUBLISHED" },
          election: { round1Date: { gte: twoWeeksAgo } },
        },
        select: {
          commune: { select: { name: true } },
          election: { select: { title: true } },
          politician: { select: POLITICIAN_SELECT },
        },
        orderBy: { election: { round1Date: "desc" } },
        take: 2,
      }),
      db.partyMembership.findMany({
        where: {
          startDate: { gte: twoWeeksAgo },
          endDate: null,
          politician: { publicationStatus: "PUBLISHED" },
        },
        select: {
          party: { select: { shortName: true } },
          politician: { select: POLITICIAN_SELECT },
        },
        orderBy: { startDate: "desc" },
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

  const mandateItems: TopMoverItem[] = recentMandates.map((m) => ({
    politician: m.politician,
    reason: `Nouveau mandat : ${m.title}`,
    type: "mandate" as const,
    href: `/politiques/${m.politician.slug}`,
  }));

  const electionItems: TopMoverItem[] = recentElections
    .filter((c) => c.politician !== null)
    .map((c) => ({
      politician: c.politician!,
      reason: c.commune ? `Élu(e) à ${c.commune.name}` : `Élu(e) au ${c.election.title}`,
      type: "election" as const,
      href: `/politiques/${c.politician!.slug}`,
    }));

  const partyItems: TopMoverItem[] = recentPartyChanges.map((pm) => ({
    politician: pm.politician,
    reason: `A rejoint ${pm.party.shortName}`,
    type: "party" as const,
    href: `/politiques/${pm.politician.slug}`,
  }));

  return mergeAndDedupe(affairItems, electionItems, mandateItems, factcheckItems, partyItems);
}
