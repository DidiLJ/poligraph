import "server-only";
import { db } from "@/lib/db";
import { cacheTag, cacheLife } from "next/cache";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";
import {
  CONDAMNATION_STATUSES,
  EN_COURS_STATUSES,
  CLOSE_STATUSES,
} from "@/config/judicial-maturity";

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

  const affairBase = {
    publicationStatus: "PUBLISHED" as const,
    involvement: { in: ["DIRECT" as const, "INDIRECT" as const] },
  };

  const [
    politiciansCount,
    condamnationsCount,
    proceduresEnCoursCount,
    closesSansCondamnationCount,
    votesCount,
    factchecksCount,
  ] = await Promise.all([
    db.politician.count({ where: { publicationStatus: "PUBLISHED" } }),
    db.affair.count({
      where: { ...affairBase, status: { in: CONDAMNATION_STATUSES } },
    }),
    db.affair.count({
      where: { ...affairBase, status: { in: EN_COURS_STATUSES } },
    }),
    db.affair.count({
      where: { ...affairBase, status: { in: CLOSE_STATUSES } },
    }),
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
