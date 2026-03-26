import { db } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry");

  // Find all unique (electionId, communeId, listName) from existing candidacies
  // Only include candidacies with a communeId (ElectoralList.communeId is required)
  const lists = await db.$queryRaw<
    Array<{
      electionId: string;
      communeId: string;
      listName: string;
      partyLabel: string | null;
      count: bigint;
    }>
  >(Prisma.sql`
    SELECT
      "electionId",
      "communeId",
      "listName",
      MIN("partyLabel") AS "partyLabel",
      COUNT(*) AS count
    FROM "Candidacy"
    WHERE "listName" IS NOT NULL
      AND "communeId" IS NOT NULL
    GROUP BY "electionId", "communeId", "listName"
    ORDER BY count DESC
  `);

  console.log(`Found ${lists.length} unique electoral lists`);

  if (dryRun) {
    console.log("DRY RUN - no changes made");
    console.log(`Top 10 by candidate count:`);
    for (const l of lists.slice(0, 10)) {
      console.log(`  ${l.listName} (${l.communeId}) - ${l.count} candidates`);
    }
    await db.$disconnect();
    return;
  }

  // Create ElectoralList entries in batches
  const BATCH_SIZE = 500;
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < lists.length; i += BATCH_SIZE) {
    const batch = lists.slice(i, i + BATCH_SIZE);

    for (const list of batch) {
      try {
        const el = await db.electoralList.upsert({
          where: {
            electionId_communeId_listName: {
              electionId: list.electionId,
              communeId: list.communeId,
              listName: list.listName,
            },
          },
          create: {
            electionId: list.electionId,
            communeId: list.communeId,
            listName: list.listName,
            partyLabel: list.partyLabel,
          },
          update: {},
        });

        // Backfill candidacies
        await db.candidacy.updateMany({
          where: {
            electionId: list.electionId,
            communeId: list.communeId,
            listName: list.listName,
            electoralListId: null,
          },
          data: { electoralListId: el.id },
        });

        created++;
      } catch (e) {
        console.error(`Skipped list: ${list.listName} (${list.communeId}):`, e);
        skipped++;
      }
    }

    console.log(
      `Progress: ${i + batch.length}/${lists.length} (created: ${created}, skipped: ${skipped})`
    );
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`);
  await db.$disconnect();
}

main().catch(console.error);
