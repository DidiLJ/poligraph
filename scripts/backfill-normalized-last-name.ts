/**
 * One-shot backfill: populate normalizedLastName for all politicians that
 * currently have NULL in that column.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/backfill-normalized-last-name.ts
 */

/* eslint-disable no-console */
import "dotenv/config";
import { db } from "@/lib/db";
import { FrenchNormalizer } from "@/lib/identity/adapters/fr/normalizer";

const CONCURRENCY = 10;

async function main() {
  const normalizer = new FrenchNormalizer();

  const politicians = await db.politician.findMany({
    where: { normalizedLastName: null },
    select: { id: true, lastName: true },
  });

  console.log(`Found ${politicians.length} politicians with no normalizedLastName.`);

  if (politicians.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let updated = 0;

  for (let i = 0; i < politicians.length; i += CONCURRENCY) {
    const chunk = politicians.slice(i, i + CONCURRENCY);

    await Promise.all(
      chunk.map((p) =>
        db.politician.update({
          where: { id: p.id },
          data: { normalizedLastName: normalizer.normalizeLastName(p.lastName) },
        })
      )
    );

    updated += chunk.length;
    if (updated % 1000 === 0 || updated === politicians.length) {
      console.log(`  Updated ${updated}/${politicians.length}...`);
    }
  }

  console.log(`Done. Backfilled ${updated} politicians.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
