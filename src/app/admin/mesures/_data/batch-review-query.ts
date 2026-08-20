import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { MAX_MEASURE_REVIEW_BATCH_SIZE } from "@/lib/measures/batch-review";

const ELIGIBLE_MEASURE_WHERE = {
  publicationStatus: "DRAFT",
  publishedRevisionId: null,
  latestRevision: {
    is: {
      reviewedAt: null,
      publishedAt: null,
      discardedAt: null,
      supersededAt: null,
      rejectedAt: null,
      sources: { some: {} },
    },
  },
} satisfies Prisma.MeasureWhereInput;

export type BatchReviewItem = {
  measureId: string;
  revisionId: string;
  text: string;
};

export type BatchReviewGroup = {
  programEditionId: string;
  editionLabel: string;
  editionVersion: number;
  ownerLabel: string;
  electionTitle: string;
  items: BatchReviewItem[];
  hasMore: boolean;
};

/** Lists sourced active drafts by programme edition, ready for one explicit human decision. */
export async function queryBatchReviewGroups(
  filters: {
    candidacyId?: string;
  } = {}
): Promise<BatchReviewGroup[]> {
  const eligibleWhere: Prisma.MeasureWhereInput = filters.candidacyId
    ? { ...ELIGIBLE_MEASURE_WHERE, candidacyId: filters.candidacyId }
    : ELIGIBLE_MEASURE_WHERE;

  const editions = await db.programEdition.findMany({
    where: {
      ...(filters.candidacyId ? { candidacyId: filters.candidacyId } : {}),
      measures: { some: eligibleWhere },
    },
    select: {
      id: true,
      label: true,
      version: true,
      candidacy: { select: { candidateName: true } },
      party: { select: { name: true } },
      election: { select: { title: true } },
      measures: {
        where: eligibleWhere,
        select: {
          id: true,
          latestRevision: { select: { id: true, text: true } },
        },
        orderBy: { createdAt: "asc" },
        take: MAX_MEASURE_REVIEW_BATCH_SIZE + 1,
      },
    },
    orderBy: [{ publishedAt: "asc" }, { version: "asc" }],
  });

  return editions.flatMap((edition) => {
    const items = edition.measures
      .slice(0, MAX_MEASURE_REVIEW_BATCH_SIZE)
      .flatMap((measure): BatchReviewItem[] => {
        if (measure.latestRevision === null) return [];
        return [
          {
            measureId: measure.id,
            revisionId: measure.latestRevision.id,
            text: measure.latestRevision.text,
          },
        ];
      });

    if (items.length === 0) return [];
    return [
      {
        programEditionId: edition.id,
        editionLabel: edition.label,
        editionVersion: edition.version,
        ownerLabel:
          edition.candidacy?.candidateName ?? edition.party?.name ?? "Propriétaire inconnu",
        electionTitle: edition.election.title,
        items,
        hasMore: edition.measures.length > MAX_MEASURE_REVIEW_BATCH_SIZE,
      },
    ];
  });
}
