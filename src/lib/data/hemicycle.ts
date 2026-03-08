import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { POLITICAL_POSITION_ORDER } from "@/config/labels";
import type { PoliticalPosition } from "@/generated/prisma";

export interface HemicycleDeputy {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  affairCount: number;
  condamnationCount: number;
}

export interface HemicycleGroup {
  code: string;
  name: string;
  shortName: string | null;
  color: string;
  politicalPosition: PoliticalPosition | null;
  deputies: HemicycleDeputy[];
}

export async function getHemicycleData(): Promise<HemicycleGroup[]> {
  "use cache";
  cacheTag("statistics", "affairs", "politicians");
  cacheLife("minutes");

  const groups = await db.parliamentaryGroup.findMany({
    where: {
      chamber: "AN",
      mandates: { some: { isCurrent: true, type: "DEPUTE" } },
    },
    select: {
      code: true,
      name: true,
      shortName: true,
      color: true,
      politicalPosition: true,
      mandates: {
        where: { isCurrent: true, type: "DEPUTE" },
        select: {
          politician: {
            select: {
              id: true,
              slug: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              affairs: {
                where: { publicationStatus: "PUBLISHED" },
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  // Sort groups left-to-right by political position
  const positionIndex = (pos: PoliticalPosition | null) => {
    if (!pos) return POLITICAL_POSITION_ORDER.length; // unpositioned at the end
    return POLITICAL_POSITION_ORDER.indexOf(pos);
  };

  return groups
    .sort((a, b) => positionIndex(a.politicalPosition) - positionIndex(b.politicalPosition))
    .map((g) => ({
      code: g.code,
      name: g.name,
      shortName: g.shortName,
      color: g.color || "#AAAAAA",
      politicalPosition: g.politicalPosition,
      deputies: g.mandates.map((m) => ({
        id: m.politician.id,
        slug: m.politician.slug,
        firstName: m.politician.firstName,
        lastName: m.politician.lastName,
        photoUrl: m.politician.photoUrl,
        affairCount: m.politician.affairs.length,
        condamnationCount: m.politician.affairs.filter(
          (a) => a.status === "CONDAMNATION_DEFINITIVE"
        ).length,
      })),
    }));
}
