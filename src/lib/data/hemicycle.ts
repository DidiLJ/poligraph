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
  /** Weighted severity score (probité ×4, other ×1-2; condamnation ×3, MEX ×2, en cours ×1) */
  severityScore: number;
  /** Has at least one atteinte à la probité (CRITIQUE severity) */
  hasProbity: boolean;
  /** Has at least one condamnation (définitive or 1ère instance) */
  hasCondamnation: boolean;
  /** Has at least one mise en examen */
  hasMiseEnExamen: boolean;
}

export interface HemicycleGroup {
  code: string;
  name: string;
  shortName: string | null;
  color: string;
  politicalPosition: PoliticalPosition | null;
  deputies: HemicycleDeputy[];
}

/** Severity category weight */
const SEVERITY_WEIGHT: Record<string, number> = {
  CRITIQUE: 4,
  GRAVE: 2,
  SIGNIFICATIF: 1,
  MINEUR: 1,
};

/** Judicial status weight — exonerating statuses score 0 */
const STATUS_WEIGHT: Record<string, number> = {
  CONDAMNATION_DEFINITIVE: 3,
  CONDAMNATION_PREMIERE_INSTANCE: 3,
  APPEL_EN_COURS: 3,
  MISE_EN_EXAMEN: 2,
  EN_COURS: 1,
};

const CONDAMNATION_STATUSES = new Set([
  "CONDAMNATION_DEFINITIVE",
  "CONDAMNATION_PREMIERE_INSTANCE",
  "APPEL_EN_COURS",
]);

export async function getHemicycleData(): Promise<HemicycleGroup[]> {
  "use cache";
  cacheTag("statistics", "affairs", "politicians");
  cacheLife("hours");

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
        take: 1000,
        select: {
          politician: {
            select: {
              id: true,
              slug: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              affairs: {
                where: {
                  publicationStatus: "PUBLISHED",
                  involvement: "DIRECT",
                },
                select: { severity: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  const positionIndex = (pos: PoliticalPosition | null) => {
    if (!pos) return POLITICAL_POSITION_ORDER.length;
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
      deputies: g.mandates.map((m) => {
        const affairs = m.politician.affairs;
        let score = 0;
        for (const a of affairs) {
          const sw = STATUS_WEIGHT[a.status] ?? 0;
          if (sw === 0) continue; // exonerating status — skip
          score += (SEVERITY_WEIGHT[a.severity] ?? 1) * sw;
        }
        return {
          id: m.politician.id,
          slug: m.politician.slug,
          firstName: m.politician.firstName,
          lastName: m.politician.lastName,
          photoUrl: m.politician.photoUrl,
          severityScore: score,
          hasProbity: affairs.some(
            (a) => a.severity === "CRITIQUE" && (STATUS_WEIGHT[a.status] ?? 0) > 0
          ),
          hasCondamnation: affairs.some((a) => CONDAMNATION_STATUSES.has(a.status)),
          hasMiseEnExamen: affairs.some((a) => a.status === "MISE_EN_EXAMEN"),
        };
      }),
    }));
}
