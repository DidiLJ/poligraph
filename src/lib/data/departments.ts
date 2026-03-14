import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

// ============================================
// Department representatives data functions
// ============================================

export async function getDeputesByDepartment(departmentCode: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("politicians", "departments");

  return db.politician.findMany({
    where: {
      mandates: {
        some: {
          type: "DEPUTE",
          isCurrent: true,
          departmentCode,
        },
      },
    },
    include: {
      currentParty: true,
      mandates: {
        where: {
          type: "DEPUTE",
          isCurrent: true,
        },
        select: {
          constituency: true,
        },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
  });
}

export async function getSenateursByDepartment(departmentCode: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("politicians", "departments");

  return db.politician.findMany({
    where: {
      mandates: {
        some: {
          type: "SENATEUR",
          isCurrent: true,
          departmentCode,
        },
      },
    },
    include: {
      currentParty: true,
      mandates: {
        where: {
          type: "SENATEUR",
          isCurrent: true,
        },
        select: {
          constituency: true,
        },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
  });
}
