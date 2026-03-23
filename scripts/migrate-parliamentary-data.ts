/**
 * One-shot migration: copy Mandate.parliamentaryGroupId to MandateParliamentary rows.
 * Safe to re-run (skips mandates that already have parliamentaryData).
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/migrate-parliamentary-data.ts
 * Dry run: DRY_RUN=1 npx dotenv -e .env -- npx tsx scripts/migrate-parliamentary-data.ts
 */
import { db } from "@/lib/db";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  console.log(`MandateParliamentary migration ${DRY_RUN ? "(DRY RUN)" : ""}`);

  // Use raw SQL since old field may be removed from Prisma schema in future
  const mandates = await db.$queryRaw<{ id: string; parliamentaryGroupId: string }[]>`
    SELECT m.id, m."parliamentaryGroupId"
    FROM "Mandate" m
    LEFT JOIN "MandateParliamentary" mp ON mp."mandateId" = m.id
    WHERE m."parliamentaryGroupId" IS NOT NULL AND mp.id IS NULL
  `;

  console.log(`Found ${mandates.length} mandates to migrate`);

  if (DRY_RUN || mandates.length === 0) {
    await db.$disconnect();
    return;
  }

  let created = 0;
  for (const m of mandates) {
    await db.mandateParliamentary.create({
      data: {
        mandateId: m.id,
        parliamentaryGroupId: m.parliamentaryGroupId,
      },
    });
    created++;
  }

  console.log(`Created ${created} MandateParliamentary records`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
