/**
 * Import 2026 municipal election first-round results from the official
 * data.gouv.fr CSV (published day after the vote).
 *
 * Downloads the "Résultats - Communes" CSV, parses it with the 2026 wide-format
 * parser, and updates:
 *   - CommuneElectionRound (participation per commune)
 *   - Candidacy (round1Votes, round1Pct, round1Qualified, isElected)
 *   - StatsSnapshot (aggregate stats for the landing page)
 *
 * Overwrites any data previously imported by the scraper (resultats-t1.ts).
 * Idempotent — safe to re-run.
 */

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { normalizeListName } from "./resultats-t1";
import {
  splitCsvLine,
  parseWideResultRow2026,
  type CommuneResult2026,
  type ListResult2026,
} from "./parse-wide-results-2026";

// --- Data source URLs ---

const URLS = {
  resultatsCommunes: "https://www.data.gouv.fr/fr/datasets/r/4feeef01-24f7-4d5a-914f-8aa806f31ec2",
};

const ELECTION_SLUG = "municipales-2026";

// --- Types ---

interface SyncOptions {
  dryRun?: boolean;
  dept?: string;
}

interface SyncStats {
  communesProcessed: number;
  communesSkipped: number;
  candidaciesUpdated: number;
  candidaciesNotMatched: number;
  eluesT1: number;
  auSecondTour: number;
  participationSum: number;
  participationCount: number;
}

// --- Helpers ---

async function downloadCsv(url: string): Promise<string> {
  console.log(`Downloading CSV from ${url}...`);
  const response = await fetch(url, {
    headers: { "User-Agent": "Poligraph/1.0 (sync)" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const text = await response.text();
  console.log(`  Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB`);
  return text;
}

function parseCsvLines(text: string): CommuneResult2026[] {
  const lines = text.split(/\r?\n/);
  // Skip header
  const dataLines = lines.slice(1).filter((line) => line.trim().length > 0);

  const results: CommuneResult2026[] = [];
  for (const line of dataLines) {
    const cols = splitCsvLine(line);
    if (cols.length < 18) continue;
    results.push(parseWideResultRow2026(cols));
  }
  return results;
}

// --- DB operations ---

async function upsertCommuneParticipation(
  communeId: string,
  electionId: string,
  data: CommuneResult2026
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
      validVotes: data.expressedVotes,
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
      validVotes: data.expressedVotes,
    },
  });
}

async function updateCandidacyResults(
  electionId: string,
  communeId: string,
  list: ListResult2026
): Promise<number> {
  const normalizedName = normalizeListName(list.listName);

  const candidacies = await db.candidacy.findMany({
    where: { electionId, communeId },
    select: { id: true, listName: true },
  });

  // Try exact normalized match first
  let matchingIds = candidacies
    .filter((c) => c.listName && normalizeListName(c.listName) === normalizedName)
    .map((c) => c.id);

  // Fallback: try short name match
  if (matchingIds.length === 0 && list.listShortName) {
    const normalizedShort = normalizeListName(list.listShortName);
    matchingIds = candidacies
      .filter((c) => c.listName && normalizeListName(c.listName) === normalizedShort)
      .map((c) => c.id);
  }

  // Fallback: partial keyword match
  if (matchingIds.length === 0) {
    const words = normalizedName
      .split(" ")
      .filter((w) => w.length > 3)
      .slice(0, 3);
    if (words.length > 0) {
      matchingIds = candidacies
        .filter((c) => {
          if (!c.listName) return false;
          const norm = normalizeListName(c.listName);
          return words.every((w) => norm.includes(w));
        })
        .map((c) => c.id);

      if (matchingIds.length > 0) {
        console.warn(
          `  [FALLBACK] "${list.listName}" matched ${matchingIds.length} via partial in ${communeId}`
        );
      }
    }
  }

  if (matchingIds.length === 0) {
    return 0;
  }

  // Qualification: >= 10% of expressed votes to advance to T2
  const round1Qualified = list.pctExpressed >= 10;

  await db.candidacy.updateMany({
    where: { id: { in: matchingIds } },
    data: {
      round1Votes: list.votes,
      round1Pct: new Prisma.Decimal(list.pctExpressed),
      round1Qualified,
      isElected: list.isElected,
    },
  });

  return matchingIds.length;
}

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
    source: "csv-datagouv",
    updatedAt: new Date().toISOString(),
  };

  await db.statsSnapshot.upsert({
    where: { key },
    update: { data: merged, computedAt: new Date() },
    create: { key, data: merged, computedAt: new Date() },
  });
}

// --- Main sync function ---

export async function syncResultatsCsv({ dryRun = false, dept }: SyncOptions = {}) {
  console.log(`\n=== Sync Resultats CSV 2026 ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  // Load election
  const election = await db.election.findUnique({
    where: { slug: ELECTION_SLUG },
    select: { id: true },
  });

  if (!election) {
    console.error(`Election ${ELECTION_SLUG} not found in DB`);
    await db.$disconnect();
    return;
  }

  // Load communes in DB for validation
  const communes = await db.commune.findMany({ select: { id: true } });
  const communeSet = new Set(communes.map((c) => c.id));
  console.log(`${communeSet.size} communes in DB\n`);

  // Download and parse CSV
  const csvText = await downloadCsv(URLS.resultatsCommunes);
  let allResults = parseCsvLines(csvText);
  console.log(`${allResults.length} communes parsed from CSV\n`);

  // Filter by department if requested
  if (dept) {
    allResults = allResults.filter((r) => r.deptCode === dept);
    console.log(`Filtered to ${allResults.length} communes for dept ${dept}\n`);
  }

  const stats: SyncStats = {
    communesProcessed: 0,
    communesSkipped: 0,
    candidaciesUpdated: 0,
    candidaciesNotMatched: 0,
    eluesT1: 0,
    auSecondTour: 0,
    participationSum: 0,
    participationCount: 0,
  };

  let currentDept = "";

  for (const commune of allResults) {
    // Log department transitions
    if (commune.deptCode !== currentDept) {
      if (currentDept) {
        console.log(`  dept ${currentDept}: done`);
      }
      currentDept = commune.deptCode;
      console.log(`\n--- Department ${currentDept} (${commune.deptName}) ---`);
    }

    // Skip communes not in DB
    if (!communeSet.has(commune.inseeCode)) {
      stats.communesSkipped++;
      continue;
    }

    // Skip communes with no lists (participation-only rows)
    if (commune.lists.length === 0) {
      stats.communesSkipped++;
      continue;
    }

    if (!dryRun) {
      // Upsert participation
      await upsertCommuneParticipation(commune.inseeCode, election.id, commune);

      // Update each list's candidacies
      for (const list of commune.lists) {
        const count = await updateCandidacyResults(election.id, commune.inseeCode, list);
        if (count > 0) {
          stats.candidaciesUpdated += count;
        } else {
          stats.candidaciesNotMatched++;
          console.warn(
            `  [WARN] No match: "${list.listName}" (${list.nuanceCode}) in ${commune.inseeCode} ${commune.communeName}`
          );
        }
      }
    }

    const hasElected = commune.lists.some((l) => l.isElected);
    if (hasElected) stats.eluesT1++;
    else stats.auSecondTour++;

    stats.participationSum += commune.participationRate;
    stats.participationCount++;
    stats.communesProcessed++;
  }

  // Update stats snapshot
  if (!dryRun && stats.participationCount > 0) {
    await updateResultsSnapshot({
      communesDepouillees: stats.communesProcessed,
      participationMoyenne:
        Math.round((stats.participationSum / stats.participationCount) * 100) / 100,
      eluesT1: stats.eluesT1,
      auSecondTour: stats.auSecondTour,
    });
    console.log("\nStatsSnapshot updated");
  }

  // National participation (weighted by registered voters)
  let totalRegistered = 0;
  let totalVoters = 0;
  for (const c of allResults) {
    totalRegistered += c.registeredVoters;
    totalVoters += c.actualVoters;
  }
  const nationalRate = totalRegistered > 0 ? (totalVoters / totalRegistered) * 100 : 0;

  console.log(`\n=== Summary ===`);
  console.log(`Communes parsed from CSV: ${allResults.length}`);
  console.log(`Communes processed: ${stats.communesProcessed}`);
  console.log(`Communes skipped (not in DB): ${stats.communesSkipped}`);
  console.log(`Candidacies updated: ${stats.candidaciesUpdated}`);
  console.log(`Lists not matched: ${stats.candidaciesNotMatched}`);
  console.log(`Elected T1: ${stats.eluesT1}`);
  console.log(`Second tour: ${stats.auSecondTour}`);
  console.log(
    `National participation: ${nationalRate.toFixed(2)}% (${totalVoters}/${totalRegistered})`
  );
  if (stats.participationCount > 0) {
    console.log(
      `Avg commune participation: ${(stats.participationSum / stats.participationCount).toFixed(2)}%`
    );
  }

  await db.$disconnect();
}
