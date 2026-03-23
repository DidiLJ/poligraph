/**
 * One-shot migration: copy Mandate.governmentName → MandateGovernment rows.
 * Safe to re-run (skips mandates that already have governmentData).
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/migrate-government-data.ts
 * Dry run: DRY_RUN=1 npx dotenv -e .env -- npx tsx scripts/migrate-government-data.ts
 */
import { db } from "@/lib/db";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  console.log(`MandateGovernment migration ${DRY_RUN ? "(DRY RUN)" : ""}`);

  // Find mandates with governmentName but no governmentData yet
  // Uses raw SQL because governmentName column may already be removed from Prisma schema
  const mandates = await db.$queryRaw<{ id: string; governmentName: string }[]>`
    SELECT m.id, m."governmentName"
    FROM "Mandate" m
    LEFT JOIN "MandateGovernment" mg ON mg."mandateId" = m.id
    WHERE m."governmentName" IS NOT NULL AND mg.id IS NULL
  `;

  console.log(`Found ${mandates.length} mandates to migrate`);

  if (DRY_RUN || mandates.length === 0) {
    await db.$disconnect();
    return;
  }

  let created = 0;
  for (const m of mandates) {
    await db.mandateGovernment.create({
      data: {
        mandateId: m.id,
        governmentName: m.governmentName,
      },
    });
    created++;
  }

  console.log(`Created ${created} MandateGovernment records`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
