import "server-only";
import { db } from "@/lib/db";
import { cacheTag, cacheLife } from "next/cache";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";
import {
  getConvictionOnlyWhere,
  getMisEnCauseWhere,
  getFavorableOutcomeWhere,
} from "@/lib/affairs/public-filters";

export interface HomepageKPIs {
  politiciansCount: number;
  condamnationsCount: number;
  proceduresEnCoursCount: number;
  closesSansCondamnationCount: number;
  votesCount: number;
  factchecksCount: number;
}

export async function getHomepageKPIs(): Promise<HomepageKPIs> {
  "use cache";
  cacheTag("politicians", "affairs", "votes", "factchecks");
  cacheLife("minutes");

  const [
    politiciansCount,
    condamnationsCount,
    proceduresEnCoursCount,
    closesSansCondamnationCount,
    votesCount,
    factchecksCount,
  ] = await Promise.all([
    db.politician.count({ where: { publicationStatus: "PUBLISHED" } }),
    db.affair.count({ where: getConvictionOnlyWhere() }),
    db.affair.count({ where: getMisEnCauseWhere() }),
    db.affair.count({ where: getFavorableOutcomeWhere() }),
    db.scrutin.count(),
    db.factCheck.count({
      where: {
        publicationStatus: "PUBLISHED",
        source: { in: FACTCHECK_ALLOWED_SOURCES },
      },
    }),
  ]);

  return {
    politiciansCount,
    condamnationsCount,
    proceduresEnCoursCount,
    closesSansCondamnationCount,
    votesCount,
    factchecksCount,
  };
}
