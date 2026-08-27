import type { Prisma } from "@/generated/prisma";
import { PUBLIC_POLITICIAN_WHERE } from "@/lib/api/public-contract";

/**
 * Shared public predicates for the presidential corpus.
 *
 * Keep the layers separate: the hub may name a sourced personality before an editorial fiche is
 * open, while a measure result promises a complete, reachable fiche and therefore needs the
 * stronger gate.
 */
export const PUBLIC_MEASURE_REVISION_WHERE = {
  reviewedAt: { not: null },
  publishedAt: { not: null },
  supersededAt: null,
  discardedAt: null,
  rejectedAt: null,
  sources: { some: {} },
} satisfies Prisma.MeasureRevisionWhereInput;

export const PUBLIC_MEASURE_WHERE = {
  publicationStatus: "PUBLISHED",
  publishedRevisionId: { not: null },
  publishedRevision: { is: PUBLIC_MEASURE_REVISION_WHERE },
} satisfies Prisma.MeasureWhereInput;

/** A proposal the personality currently carries, rather than one recorded as withdrawn. */
export const PUBLIC_CURRENT_MEASURE_WHERE = {
  ...PUBLIC_MEASURE_WHERE,
  withdrawnAt: null,
} satisfies Prisma.MeasureWhereInput;

/** The public field shown by the hub, independently of whether a full fiche is open yet. */
export const PUBLIC_HUB_CANDIDACY_WHERE = {
  status: { not: null },
  sourceUrl: { not: null },
  sourceLabel: { not: null },
  politicianId: { not: null },
  politician: { is: PUBLIC_POLITICIAN_WHERE },
} satisfies Prisma.CandidacyWhereInput;

/** Editorial extension used by comparison surfaces. It is deliberately weaker than the fiche. */
export const PUBLIC_PRESIDENTIAL_EXTENSION_WHERE = {
  presidentialData: { is: { publicationStatus: "PUBLISHED" } },
} satisfies Prisma.CandidacyWhereInput;

/**
 * Complete candidate-fiche gate: sourced hub identity, published extension and at least one
 * currently defended, reviewed measure backed by a primary source.
 */
export const PUBLIC_PRESIDENTIAL_FICHE_WHERE = {
  ...PUBLIC_HUB_CANDIDACY_WHERE,
  ...PUBLIC_PRESIDENTIAL_EXTENSION_WHERE,
  measures: {
    some: {
      ...PUBLIC_CURRENT_MEASURE_WHERE,
      publishedRevision: {
        is: {
          ...PUBLIC_MEASURE_REVISION_WHERE,
          sources: { some: { tier: "PRIMARY" } },
        },
      },
    },
  },
} satisfies Prisma.CandidacyWhereInput;

/** Public search/detail population for presidential measures. */
export const PUBLIC_PRESIDENTIAL_MEASURE_WHERE = {
  ...PUBLIC_CURRENT_MEASURE_WHERE,
  candidacy: { is: PUBLIC_PRESIDENTIAL_FICHE_WHERE },
} satisfies Prisma.MeasureWhereInput;
