import "server-only";
import { db } from "@/lib/db";
import { cacheTag, cacheLife } from "next/cache";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";

export interface HomepageKPIs {
  politiciansCount: number;
  affairsCount: number;
  votesCount: number;
  factchecksCount: number;
  activeAffairsCount: number;
}

export async function getHomepageKPIs(): Promise<HomepageKPIs> {
  "use cache";
  cacheTag("politicians", "affairs", "votes", "factchecks");
  cacheLife("minutes");

  const [politiciansCount, affairsCount, activeAffairsCount, votesCount, factchecksCount] =
    await Promise.all([
      db.politician.count({ where: { publicationStatus: "PUBLISHED" } }),
      db.affair.count({ where: { publicationStatus: "PUBLISHED" } }),
      db.affair.count({
        where: {
          publicationStatus: "PUBLISHED",
          status: {
            in: [
              "ENQUETE_PRELIMINAIRE",
              "INSTRUCTION",
              "MISE_EN_EXAMEN",
              "RENVOI_TRIBUNAL",
              "PROCES_EN_COURS",
            ],
          },
        },
      }),
      db.scrutin.count(),
      db.factCheck.count({
        where: {
          publicationStatus: "PUBLISHED",
          source: { in: FACTCHECK_ALLOWED_SOURCES },
        },
      }),
    ]);

  return { politiciansCount, affairsCount, votesCount, factchecksCount, activeAffairsCount };
}
