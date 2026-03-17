/**
 * One-shot backfill: populate normalizedLastName for all politicians that
 * currently have NULL in that column.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/backfill-normalized-last-name.ts
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { FrenchNormalizer } from "@/lib/identity/adapters/fr/normalizer";

const BATCH_SIZE = 500;

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

  for (let i = 0; i < politicians.length; i += BATCH_SIZE) {
    const chunk = politicians.slice(i, i + BATCH_SIZE);

    const values = Prisma.join(
      chunk.map(
        (p) => Prisma.sql`(${p.id}::uuid, ${normalizer.normalizeLastName(p.lastName)}::text)`
      )
    );

    await db.$executeRaw`
      UPDATE "Politician" p
      SET "normalizedLastName" = c.normalized
      FROM (VALUES ${values}) AS c(id, normalized)
      WHERE p.id = c.id
    `;

    updated += chunk.length;
    console.log(`  Updated ${updated}/${politicians.length}...`);
  }

  console.log(`Done. Backfilled ${updated} politicians.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
