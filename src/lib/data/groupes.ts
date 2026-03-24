import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { GroupPosition, Chamber } from "@/generated/prisma";

export interface ScrutinGroupPositionData {
  id: string;
  position: GroupPosition;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  cohesionPct: number;
  group: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    color: string | null;
    slug: string | null;
  };
}

export async function getScrutinGroupPositions(
  scrutinId: string
): Promise<ScrutinGroupPositionData[]> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutinGroupPosition.findMany({
    where: { scrutinId },
    include: {
      group: {
        select: {
          id: true,
          code: true,
          name: true,
          shortName: true,
          color: true,
          slug: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { forCount: "desc" }],
  });
}

export interface ScrutinAnalysisData {
  argumentsFor: string;
  argumentsAgainst: string;
  sourceType: string;
  modelVersion: string;
}

export async function getScrutinAnalysis(scrutinId: string): Promise<ScrutinAnalysisData | null> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutinAnalysis.findUnique({
    where: { scrutinId },
    select: {
      argumentsFor: true,
      argumentsAgainst: true,
      sourceType: true,
      modelVersion: true,
    },
  });
}

export interface GroupListingItem {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string | null;
  slug: string | null;
  chamber: Chamber;
  politicalPosition: string | null;
  seatCount: number;
  stats: {
    cohesionPct: number;
    governmentAlignmentPct: number;
    averageParticipationPct: number;
  } | null;
}

export async function getGroupesListing(
  options: {
    chamber?: Chamber;
    legislature?: number;
  } = {}
): Promise<GroupListingItem[]> {
  "use cache";
  cacheTag("votes", "groupes");
  cacheLife("hours");

  const { chamber, legislature = 17 } = options;

  const groups = await db.parliamentaryGroup.findMany({
    where: {
      ...(chamber && { chamber }),
      legislature,
    },
    include: {
      stats: {
        where: { legislature },
        take: 1,
      },
      _count: {
        select: {
          mandates: {
            where: {
              mandate: { isCurrent: true },
            },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  return groups.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    shortName: g.shortName,
    color: g.color,
    slug: g.slug,
    chamber: g.chamber,
    politicalPosition: g.politicalPosition,
    seatCount: g._count.mandates,
    stats: g.stats[0]
      ? {
          cohesionPct: g.stats[0].cohesionPct,
          governmentAlignmentPct: g.stats[0].governmentAlignmentPct,
          averageParticipationPct: g.stats[0].averageParticipationPct,
        }
      : null,
  }));
}

export async function getGroupeDetail(slug: string) {
  "use cache";
  cacheTag("votes", "groupes");
  cacheLife("hours");

  const group = await db.parliamentaryGroup.findUnique({
    where: { slug },
    include: {
      stats: { take: 1, orderBy: { computedAt: "desc" } },
      mandates: {
        where: { mandate: { isCurrent: true } },
        include: {
          mandate: {
            include: {
              politician: {
                select: {
                  id: true,
                  slug: true,
                  firstName: true,
                  lastName: true,
                  fullName: true,
                  photoUrl: true,
                  currentParty: { select: { shortName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!group) return null;

  return {
    ...group,
    seatCount: group.mandates.length,
    members: group.mandates.map((m) => m.mandate.politician),
  };
}
