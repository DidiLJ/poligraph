import "server-only";

import { cache } from "react";
import type {
  Chamber,
  MeasurePrecision,
  MeasureSourceKind,
  SourceTier,
  ThemeCategory,
} from "@/generated/prisma";
import { db } from "@/lib/db";
import { PUBLIC_PRESIDENTIAL_MEASURE_WHERE } from "@/lib/presidentielle/publication";
import { deriveVoteRelation, type VoteRelation } from "@/lib/measures/vote-relation";

export type PublicPresidentialMeasureDetail = {
  id: string;
  slug: string;
  electionSlug: string;
  theme: ThemeCategory;
  text: string;
  details: string | null;
  precision: MeasurePrecision | null;
  reviewedAt: Date;
  publishedAt: Date;
  candidate: {
    name: string;
    slug: string;
    photoUrl: string | null;
    blobPhotoUrl: string | null;
    party: string | null;
  };
  sources: Array<{
    id: string;
    sourceKind: MeasureSourceKind;
    tier: SourceTier;
    url: string;
    page: string | null;
    publishedAt: Date;
  }>;
  votes: Array<{
    id: string;
    relation: VoteRelation;
    checkedAt: Date;
    institutionScope: Chamber[];
    scrutin: {
      id: string;
      slug: string | null;
      title: string;
      votingDate: Date;
      chamber: Chamber;
      sourceUrl: string | null;
    } | null;
  }>;
};

async function loadPublicPresidentialMeasureDetail(electionSlug: string, measureSlug: string) {
  const row = await db.measure.findFirst({
    where: {
      slug: measureSlug,
      election: { slug: electionSlug },
      ...PUBLIC_PRESIDENTIAL_MEASURE_WHERE,
    },
    select: {
      id: true,
      slug: true,
      theme: true,
      election: { select: { slug: true } },
      publishedRevisionId: true,
      publishedRevision: {
        select: {
          text: true,
          details: true,
          precision: true,
          reviewedAt: true,
          publishedAt: true,
          sources: {
            orderBy: { publishedAt: "asc" },
            select: {
              id: true,
              sourceKind: true,
              tier: true,
              url: true,
              page: true,
              publishedAt: true,
            },
          },
        },
      },
      candidacy: {
        select: {
          candidateName: true,
          party: { select: { name: true, shortName: true } },
          politician: {
            select: {
              slug: true,
              photoUrl: true,
              blobPhotoUrl: true,
            },
          },
        },
      },
      voteLinks: {
        orderBy: { checkedAt: "desc" },
        select: {
          id: true,
          applicableRevisionId: true,
          linkKind: true,
          relation: true,
          checkedAt: true,
          institutionScope: true,
          scrutin: {
            select: {
              id: true,
              slug: true,
              title: true,
              votingDate: true,
              chamber: true,
              sourceUrl: true,
            },
          },
        },
      },
    },
  });
  const revision = row?.publishedRevision;
  const candidate = row?.candidacy;
  if (
    !row ||
    !revision ||
    !row.publishedRevisionId ||
    !revision.reviewedAt ||
    !revision.publishedAt ||
    !candidate?.politician
  ) {
    return null;
  }
  const publishedRevisionId = row.publishedRevisionId;

  return {
    id: row.id,
    slug: row.slug,
    electionSlug: row.election.slug,
    theme: row.theme,
    text: revision.text,
    details: revision.details,
    precision: revision.precision,
    reviewedAt: revision.reviewedAt,
    publishedAt: revision.publishedAt,
    candidate: {
      name: candidate.candidateName,
      slug: candidate.politician.slug,
      photoUrl: candidate.politician.photoUrl,
      blobPhotoUrl: candidate.politician.blobPhotoUrl,
      party: candidate.party?.shortName ?? candidate.party?.name ?? null,
    },
    sources: revision.sources,
    votes: row.voteLinks.map((link) => ({
      id: link.id,
      relation: deriveVoteRelation(
        [
          {
            linkKind: link.linkKind,
            applicableRevisionId: link.applicableRevisionId,
            position: link.relation,
          },
        ],
        publishedRevisionId
      ),
      checkedAt: link.checkedAt,
      institutionScope: link.institutionScope,
      scrutin: link.scrutin,
    })),
  };
}

export const getPublicPresidentialMeasureDetail = cache(loadPublicPresidentialMeasureDetail);

export async function getPublicPresidentialMeasureSlugByLegacyId(
  electionSlug: string,
  measureId: string
): Promise<string | null> {
  const row = await db.measure.findFirst({
    where: {
      id: measureId,
      election: { slug: electionSlug },
      ...PUBLIC_PRESIDENTIAL_MEASURE_WHERE,
    },
    select: { slug: true },
  });
  return row?.slug ?? null;
}
