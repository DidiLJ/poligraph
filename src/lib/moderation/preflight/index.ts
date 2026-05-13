import { db } from "@/lib/db";
import { moderateAffair, type ModerationResult } from "@/services/affair-moderation";
import {
  findPotentialDuplicates,
  type PotentialDuplicate,
} from "@/services/affairs/reconciliation";
import { auditAttribution } from "./attribution";
import type {
  ModerationPreflightReport,
  DraftCandidate,
  DuplicateGroup,
  ModerationRecommendation,
} from "@/types/moderation-preflight";

interface RunPreflightOptions {
  source: "cron" | "manual";
  limit?: number;
}

export async function runPreflight(
  options: RunPreflightOptions
): Promise<ModerationPreflightReport> {
  const drafts = await db.affair.findMany({
    where: { publicationStatus: "DRAFT" },
    orderBy: { createdAt: "asc" },
    take: options.limit,
    include: {
      politician: {
        select: { id: true, slug: true, fullName: true, normalizedLastName: true },
      },
      sources: true,
      events: { orderBy: { date: "asc" } },
    },
  });

  const allPoliticians = await db.politician.findMany({
    select: { id: true, fullName: true, normalizedLastName: true },
  });

  const politicianRoster = allPoliticians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    normalizedLastName: p.normalizedLastName ?? p.fullName,
  }));

  const duplicates = await findPotentialDuplicates();
  const duplicateGroups = buildDuplicateGroups(duplicates);
  const duplicatesByAffair = buildDuplicateIndex(duplicates);

  const draftCandidates: DraftCandidate[] = [];
  for (const draft of drafts) {
    if (!draft.politician) continue;

    const moderation = await moderateAffair({
      affairId: draft.id,
      title: draft.title,
      description: draft.description ?? "",
      status: draft.status,
      category: draft.category ?? "AUTRE",
      involvement: draft.involvement ?? "MENTIONED_ONLY",
      politicianName: draft.politician.fullName,
      politicianSlug: draft.politician.slug,
      sources: draft.sources.map((s) => ({
        url: s.url,
        title: s.title ?? "",
        publisher: s.publisher ?? "",
        publishedAt: s.publishedAt?.toISOString() ?? "",
      })),
      factsDate: draft.factsDate?.toISOString() ?? null,
      startDate: draft.startDate?.toISOString() ?? null,
      verdictDate: draft.verdictDate?.toISOString() ?? null,
      court: draft.court ?? null,
      sentence: draft.sentence ?? null,
    });

    const attribution = auditAttribution({
      affairTitle: draft.title,
      affairDescription: draft.description ?? "",
      politician: {
        id: draft.politician.id,
        fullName: draft.politician.fullName,
        normalizedLastName: draft.politician.normalizedLastName ?? draft.politician.fullName,
      },
      otherPoliticians: politicianRoster.filter((p) => p.id !== draft.politician!.id),
    });

    draftCandidates.push({
      id: draft.id,
      title: draft.title,
      publicationStatus: "DRAFT",
      createdAt: draft.createdAt.toISOString(),
      politician: {
        id: draft.politician.id,
        slug: draft.politician.slug,
        fullName: draft.politician.fullName,
      },
      category: draft.category ?? "AUTRE",
      status: draft.status,
      preflight: {
        moderationRecommendation: mapModerationRec(moderation),
        moderationIssues: moderation.issues,
        attribution,
        duplicateOf: duplicatesByAffair.get(draft.id) ?? [],
      },
    });
  }

  const stats = {
    totalDrafts: draftCandidates.length,
    duplicateGroups: duplicateGroups.length,
    attributionIssues: draftCandidates.filter(
      (d) => d.preflight.attribution.confidence !== "STRONG"
    ).length,
    autoPublishCandidates: draftCandidates.filter(
      (d) =>
        d.preflight.moderationRecommendation === "PUBLISH" &&
        d.preflight.attribution.confidence === "STRONG" &&
        d.preflight.duplicateOf.length === 0
    ).length,
    needsReview: draftCandidates.filter(
      (d) => d.preflight.moderationRecommendation === "NEEDS_REVIEW"
    ).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    ttlHours: 24,
    source: options.source,
    stats,
    drafts: draftCandidates,
    duplicateGroups,
  };
}

function mapModerationRec(result: ModerationResult): ModerationRecommendation {
  if (result.recommendation === "PUBLISH") return "PUBLISH";
  if (result.recommendation === "REJECT") return "REJECT";
  return "NEEDS_REVIEW";
}

function buildDuplicateIndex(pairs: PotentialDuplicate[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const pair of pairs) {
    const aList = index.get(pair.affairA.id) ?? [];
    aList.push(pair.affairB.id);
    index.set(pair.affairA.id, aList);

    const bList = index.get(pair.affairB.id) ?? [];
    bList.push(pair.affairA.id);
    index.set(pair.affairB.id, bList);
  }
  return index;
}

function buildDuplicateGroups(pairs: PotentialDuplicate[]): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let p = parent.get(id) ?? id;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(id, p);
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const pair of pairs) {
    union(pair.affairA.id, pair.affairB.id);
  }

  const groups = new Map<string, { ids: string[]; score: number; matchedBy: string }>();
  for (const pair of pairs) {
    const root = find(pair.affairA.id);
    const entry = groups.get(root) ?? { ids: [], score: 0, matchedBy: pair.matchedBy };
    if (!entry.ids.includes(pair.affairA.id)) entry.ids.push(pair.affairA.id);
    if (!entry.ids.includes(pair.affairB.id)) entry.ids.push(pair.affairB.id);
    entry.score = Math.max(entry.score, pair.score);
    groups.set(root, entry);
  }

  const result: DuplicateGroup[] = [];
  for (const entry of groups.values()) {
    const recommendedKeep = entry.ids[0];
    if (!recommendedKeep) continue;
    result.push({
      affairIds: entry.ids,
      score: entry.score,
      matchedBy: entry.matchedBy,
      recommendedKeep,
      autoMergeEligible: entry.score >= 0.95,
    });
  }
  return result;
}
