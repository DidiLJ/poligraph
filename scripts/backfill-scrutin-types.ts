/**
 * One-time backfill: classify all existing scrutins by type.
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/backfill-scrutin-types.ts
 *        npx dotenv -e .env -- npx tsx scripts/backfill-scrutin-types.ts --dry
 */

import { db } from "@/lib/db";
import { classifyScrutinTitle } from "@/lib/scrutin-type";
import type { ScrutinType } from "@/generated/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry");

  console.log(`Backfilling scrutin types${dryRun ? " (DRY RUN)" : ""}...\n`);

  const reclassify = process.argv.includes("--reclassify");

  const scrutins = await db.scrutin.findMany({
    where: reclassify ? {} : { type: null },
    select: { id: true, title: true, type: true },
  });

  console.log(
    `Found ${scrutins.length} scrutins ${reclassify ? "to reclassify" : "without type"}\n`
  );

  if (scrutins.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Group by classified type for efficient batch updates
  const groups = new Map<ScrutinType, string[]>();
  let reclassified = 0;
  for (const s of scrutins) {
    const type = classifyScrutinTitle(s.title);
    if (reclassify && s.type === type) continue;
    if (reclassify && s.type !== type) reclassified++;
    const ids = groups.get(type) ?? [];
    ids.push(s.id);
    groups.set(type, ids);
  }

  // Print changes
  const totalChanges = [...groups.values()].reduce((sum, ids) => sum + ids.length, 0);
  console.log(`Changes: ${totalChanges}${reclassify ? ` (${reclassified} reclassified)` : ""}`);
  for (const [type, ids] of groups) {
    console.log(`  -> ${type}: ${ids.length}`);
  }
  console.log();

  if (dryRun) {
    console.log("Dry run complete.");
    return;
  }

  // Batch update by type (one query per type = ~5 queries)
  for (const [type, ids] of groups) {
    const result = await db.scrutin.updateMany({
      where: { id: { in: ids } },
      data: { type },
    });
    console.log(`Updated ${result.count} scrutins to ${type}`);
  }

  console.log("\nBackfill complete.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
