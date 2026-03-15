import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { httpClient } from "@/lib/api/http-client";
import { INTERIEUR_RATE_LIMIT_MS } from "@/config/rate-limits";

// --- Configuration ---

// Ministry results base URL (to be confirmed on election night)
const BASE_URL = "https://www.resultats-elections.interieur.gouv.fr";

// All French department codes
const DEPARTMENT_CODES = [
  ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, "0")),
  "2A",
  "2B", // Corsica
  "971",
  "972",
  "973",
  "974",
  "976", // DOM
].filter((d) => d !== "20"); // Replace 20 with 2A/2B

interface SyncOptions {
  dryRun?: boolean;
  dept?: string;
}

interface ParsedCommuneResult {
  inseeCode: string;
  communeName: string;
  registeredVoters: number;
  actualVoters: number;
  blankVotes: number;
  nullVotes: number;
  validVotes: number;
  participationRate: number;
  lists: ParsedListResult[];
}

interface ParsedListResult {
  listName: string;
  leaderName: string;
  nuance: string;
  round1Votes: number;
  round1Pct: number;
  round1Qualified: boolean;
  isElected: boolean;
}

// --- Parsing ---

/**
 * Parse a commune results page HTML.
 * NOTE: The exact selectors depend on the ministry site structure.
 * This will need adaptation once we see the actual HTML on election night.
 */
export function parseCommuneResultsHtml(
  html: string,
  _inseeCode: string
): ParsedCommuneResult | null {
  const $ = cheerio.load(html);

  // TODO: Adapt selectors to actual ministry HTML structure
  // The structure typically includes:
  // - A participation table (inscrits, votants, blancs, nuls, exprimes)
  // - A results table per list (nom, nuance, voix, %, elu/qualifie)
  //
  // For now, this is a skeleton that will be filled once we see the HTML.
  // Use Claude Code terminal to inspect a page and fill in selectors.

  void $; // suppress unused warning

  return null; // Placeholder - fill during recon
}

/**
 * Normalize a list name for matching against existing Candidacy records.
 * Handles casing, extra whitespace, punctuation differences.
 */
export function normalizeListName(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Database operations ---

async function upsertCommuneParticipation(
  communeId: string,
  electionId: string,
  data: ParsedCommuneResult
) {
  await db.communeElectionRound.upsert({
    where: {
      communeId_electionId_round: {
        communeId,
        electionId,
        round: 1,
      },
    },
    update: {
      registeredVoters: data.registeredVoters,
      actualVoters: data.actualVoters,
      participationRate: new Prisma.Decimal(data.participationRate),
      blankVotes: data.blankVotes,
      nullVotes: data.nullVotes,
      validVotes: data.validVotes,
    },
    create: {
      communeId,
      electionId,
      round: 1,
      registeredVoters: data.registeredVoters,
      actualVoters: data.actualVoters,
      participationRate: new Prisma.Decimal(data.participationRate),
      blankVotes: data.blankVotes,
      nullVotes: data.nullVotes,
      validVotes: data.validVotes,
    },
  });
}

async function updateCandidacyResults(
  electionId: string,
  communeId: string,
  list: ParsedListResult
) {
  const normalizedName = normalizeListName(list.listName);

  // Find matching candidacies by commune + normalized list name
  const candidacies = await db.candidacy.findMany({
    where: { electionId, communeId },
    select: { id: true, listName: true },
  });

  const matchingIds = candidacies
    .filter((c) => c.listName && normalizeListName(c.listName) === normalizedName)
    .map((c) => c.id);

  if (matchingIds.length === 0) {
    // Fallback: try partial match on first significant words
    const words = normalizedName
      .split(" ")
      .filter((w) => w.length > 3)
      .slice(0, 3);
    if (words.length > 0) {
      const fallbackIds = candidacies
        .filter((c) => {
          if (!c.listName) return false;
          const norm = normalizeListName(c.listName);
          return words.every((w) => norm.includes(w));
        })
        .map((c) => c.id);

      if (fallbackIds.length > 0) {
        console.warn(
          `  [FALLBACK] "${list.listName}" matched ${fallbackIds.length} candidacies via partial match in ${communeId}`
        );
        await db.candidacy.updateMany({
          where: { id: { in: fallbackIds } },
          data: {
            round1Votes: list.round1Votes,
            round1Pct: new Prisma.Decimal(list.round1Pct),
            round1Qualified: list.round1Qualified,
            isElected: list.isElected,
          },
        });
        return fallbackIds.length;
      }
    }

    console.warn(`  [WARN] No match for list "${list.listName}" in commune ${communeId}`);
    return 0;
  }

  await db.candidacy.updateMany({
    where: { id: { in: matchingIds } },
    data: {
      round1Votes: list.round1Votes,
      round1Pct: new Prisma.Decimal(list.round1Pct),
      round1Qualified: list.round1Qualified,
      isElected: list.isElected,
    },
  });

  return matchingIds.length;
}

// --- Stats snapshot ---

async function updateResultsSnapshot(stats: {
  communesDepouillees: number;
  participationMoyenne: number;
  eluesT1: number;
  auSecondTour: number;
}) {
  const key = "municipales-2026-resultats";
  const existing = await db.statsSnapshot.findUnique({ where: { key } });
  const merged = {
    ...((existing?.data as Record<string, unknown>) ?? {}),
    ...stats,
  };

  await db.statsSnapshot.upsert({
    where: { key },
    update: { data: merged },
    create: { key, data: merged },
  });
}

// --- Helpers ---

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main orchestrator ---

export async function syncResultatsT1({ dryRun = false, dept }: SyncOptions = {}) {
  console.log(`\n=== Sync Resultats T1 ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });

  if (!election) {
    console.error("Election municipales-2026 not found");
    return;
  }

  const departments = dept ? [dept] : DEPARTMENT_CODES;
  const totalCommunesProcessed = 0;
  const totalCommunesNoResults = 0;
  const totalWarnings = 0;
  const totalEluesT1 = 0;
  const totalSecondTour = 0;
  const participationSum = 0;
  const participationCount = 0;

  for (const deptCode of departments) {
    console.log(`\n--- Department ${deptCode} ---`);

    // TODO: Fetch department index page to get list of commune URLs
    // Then for each commune, fetch + parse + upsert
    // This is the main loop to fill once we see the ministry URL structure.

    // Placeholder structure:
    // const communeUrls = await fetchDepartmentCommuneList(deptCode);
    // for (const { inseeCode, url } of communeUrls) {
    //   await sleep(INTERIEUR_RATE_LIMIT_MS);
    //   const html = await httpClient.getText(url);
    //   const result = parseCommuneResultsHtml(html.data, inseeCode);
    //   if (!result) { totalCommunesNoResults++; continue; }
    //
    //   if (!dryRun) {
    //     await upsertCommuneParticipation(inseeCode, election.id, result);
    //     for (const list of result.lists) {
    //       const count = await updateCandidacyResults(election.id, inseeCode, list);
    //       if (count === 0) totalWarnings++;
    //     }
    //   }
    //
    //   const hasElected = result.lists.some(l => l.isElected);
    //   if (hasElected) totalEluesT1++;
    //   else totalSecondTour++;
    //   participationSum += result.participationRate;
    //   participationCount++;
    //   totalCommunesProcessed++;
    //
    //   console.log(`  ${result.communeName}: ${result.lists.length} listes, ${result.participationRate}% participation`);
    // }

    void deptCode; // suppress unused warning for placeholder
  }

  // Update stats snapshot
  if (!dryRun && participationCount > 0) {
    await updateResultsSnapshot({
      communesDepouillees: totalCommunesProcessed,
      participationMoyenne: Math.round((participationSum / participationCount) * 100) / 100,
      eluesT1: totalEluesT1,
      auSecondTour: totalSecondTour,
    });
  }

  console.log(`\n=== Summary ===`);
  console.log(`Communes processed: ${totalCommunesProcessed}`);
  console.log(`Communes no results: ${totalCommunesNoResults}`);
  console.log(`Warnings (matching): ${totalWarnings}`);
  console.log(`Elected T1: ${totalEluesT1}`);
  console.log(`Second tour: ${totalSecondTour}`);
  if (participationCount > 0) {
    console.log(`Avg participation: ${(participationSum / participationCount).toFixed(2)}%`);
  }

  // Suppress unused references in skeleton mode
  void httpClient;
  void sleep;
  void INTERIEUR_RATE_LIMIT_MS;
  void BASE_URL;
  void upsertCommuneParticipation;
  void updateCandidacyResults;
}
