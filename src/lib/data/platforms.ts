import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { ThematicAxis, PublicationStatus } from "@/generated/prisma";

// --- Single platform by party slug + election ---

export const getPartyPlatform = cache(async function getPartyPlatform(
  partySlug: string,
  electionId?: string
) {
  "use cache";
  cacheTag(`party:${partySlug}`, "platforms");
  cacheLife("minutes");

  const where: Record<string, unknown> = {
    party: { slug: partySlug },
    publicationStatus: "PUBLISHED",
  };
  if (electionId) where.electionId = electionId;

  const platform = await db.platform.findFirst({
    where,
    include: {
      proposals: {
        orderBy: { axis: "asc" },
      },
      party: {
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          color: true,
          logoUrl: true,
        },
      },
      election: {
        select: { id: true, slug: true, title: true, type: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return platform;
});

// --- All platforms for a given election ---

export async function getPlatformsByElection(electionId: string) {
  "use cache";
  cacheTag("platforms");
  cacheLife("minutes");

  return db.platform.findMany({
    where: {
      electionId,
      publicationStatus: "PUBLISHED",
    },
    include: {
      proposals: true,
      party: {
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          color: true,
          logoUrl: true,
        },
      },
    },
    orderBy: { party: { name: "asc" } },
  });
}

// --- All published platforms (for hub page) ---

async function queryPlatforms(status?: PublicationStatus) {
  return db.platform.findMany({
    where: {
      publicationStatus: status || "PUBLISHED",
    },
    include: {
      party: {
        select: { slug: true, name: true, shortName: true, color: true, logoUrl: true },
      },
      election: {
        select: { slug: true, title: true, type: true, round1Date: true },
      },
      _count: { select: { proposals: true } },
    },
    orderBy: { election: { round1Date: "desc" } },
  });
}

export async function getPlatformsListing() {
  "use cache";
  cacheTag("platforms");
  cacheLife("minutes");
  return queryPlatforms();
}

// --- Proposals for matching (quiz) ---

export async function getPartyPositionsForMatching(electionId: string) {
  "use cache";
  cacheTag("platforms");
  cacheLife("hours");

  const platforms = await db.platform.findMany({
    where: {
      electionId,
      publicationStatus: "PUBLISHED",
    },
    include: {
      proposals: {
        // verifiedBy is a String? - use { not: null } for scalar fields
        where: { verifiedBy: { not: null } },
        select: { axis: true, position: true },
      },
      party: {
        select: {
          slug: true,
          name: true,
          shortName: true,
          color: true,
          logoUrl: true,
        },
      },
    },
  });

  return platforms.map((p) => ({
    party: p.party!,
    positions: Object.fromEntries(p.proposals.map((pr) => [pr.axis, pr.position])) as Partial<
      Record<ThematicAxis, number>
    >,
  }));
}

// --- Quiz questions ---

export async function getQuizQuestions(scope?: "COMMON" | "NATIONAL" | "MUNICIPAL") {
  "use cache";
  cacheTag("quiz-questions");
  cacheLife("hours");

  return db.quizQuestion.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      ...(scope ? { scope } : {}),
    },
    orderBy: [{ scope: "asc" }, { order: "asc" }],
  });
}
