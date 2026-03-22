/**
 * Enrich MandateLocal.firstElectedDate from Wikidata P39 data.
 *
 * Finds all maires with a Wikidata ExternalId but no firstElectedDate,
 * fetches their P39 (position held) claims, and sets the earliest start date
 * for Q30185 (maire de commune française).
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/enrich-first-elected.ts           # apply
 *   npx dotenv -e .env -- npx tsx scripts/enrich-first-elected.ts --dry-run # preview only
 */

import { db } from "@/lib/db";
import { WikidataService } from "@/lib/api/wikidata";
import { WD_POSITIONS } from "@/config/wikidata";

const BATCH_SIZE = 50;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Mode: ${dryRun ? "DRY RUN (use without --dry-run to apply)" : "APPLY"}\n`);

  const wiki = new WikidataService({ rateLimitMs: 200 });

  // Find candidates: current MAIRE mandates with MandateLocal + Wikidata ID + no firstElectedDate
  const candidates = await db.mandate.findMany({
    where: {
      type: "MAIRE",
      isCurrent: true,
      localData: { firstElectedDate: null },
      politician: {
        externalIds: { some: { source: "WIKIDATA" } },
      },
    },
    select: {
      id: true,
      localData: { select: { id: true } },
      politician: {
        select: {
          fullName: true,
          externalIds: {
            where: { source: "WIKIDATA" },
            select: { externalId: true },
            take: 1,
          },
        },
      },
    },
  });

  console.log(`Found ${candidates.length} maires with Wikidata IDs to enrich`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    await db.$disconnect();
    return;
  }

  let enriched = 0;
  let skipped = 0;
  const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // Build wikidataId -> candidate mapping
    const wdIdToCandidate = new Map<string, (typeof candidates)[number]>();
    const wikidataIds: string[] = [];

    for (const c of batch) {
      const wdId = c.politician.externalIds[0]?.externalId;
      if (!wdId) continue;
      wdIdToCandidate.set(wdId, c);
      wikidataIds.push(wdId);
    }

    if (wikidataIds.length === 0) {
      console.log(`Batch ${batchNum}/${totalBatches}: no Wikidata IDs, skipping`);
      continue;
    }

    // Fetch all positions from Wikidata
    const positionsMap = await wiki.getPositions(wikidataIds);

    for (const [wdId, positions] of positionsMap) {
      const candidate = wdIdToCandidate.get(wdId);
      if (!candidate?.localData) continue;

      // Find earliest maire position start date (Q30185 = maire de commune française)
      const mairePositions = positions.filter(
        (p) => p.positionId === WD_POSITIONS.MAIRE && p.startDate
      );

      if (mairePositions.length === 0) {
        skipped++;
        continue;
      }

      const earliest = mairePositions.reduce((min, p) => (p.startDate! < min.startDate! ? p : min));

      if (!dryRun) {
        await db.mandateLocal.update({
          where: { id: candidate.localData.id },
          data: { firstElectedDate: earliest.startDate },
        });
      }

      console.log(
        `  ${dryRun ? "[dry] " : ""}${candidate.politician.fullName}: ${earliest.startDate!.toISOString().slice(0, 10)}`
      );
      enriched++;
    }

    console.log(
      `Batch ${batchNum}/${totalBatches}: ${enriched} enriched so far, ${skipped} skipped so far`
    );
  }

  console.log(`\nDone. Enriched: ${enriched}, Skipped (no maire P39): ${skipped}`);

  if (dryRun && enriched > 0) {
    console.log("\nRe-run without --dry-run to apply changes.");
  }

  await db.$disconnect();
}

main().catch(console.error);
