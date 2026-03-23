/**
 * One-shot migration: copy Mandate.europeanGroupId/Code to MandateEuropean rows.
 * Safe to re-run (skips mandates that already have europeanData).
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/migrate-european-data.ts
 * Dry run: DRY_RUN=1 npx dotenv -e .env -- npx tsx scripts/migrate-european-data.ts
 */
import { db } from "@/lib/db";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  console.log(`MandateEuropean migration ${DRY_RUN ? "(DRY RUN)" : ""}`);

  const mandates = await db.$queryRaw<
    { id: string; europeanGroupId: string; europeanGroupCode: string | null }[]
  >`
    SELECT m.id, m."europeanGroupId", m."europeanGroupCode"
    FROM "Mandate" m
    LEFT JOIN "MandateEuropean" me ON me."mandateId" = m.id
    WHERE m."europeanGroupId" IS NOT NULL AND me.id IS NULL
  `;

  console.log(`Found ${mandates.length} mandates to migrate`);

  if (DRY_RUN || mandates.length === 0) {
    await db.$disconnect();
    return;
  }

  let created = 0;
  for (const m of mandates) {
    await db.mandateEuropean.create({
      data: {
        mandateId: m.id,
        europeanGroupId: m.europeanGroupId,
        europeanGroupCode: m.europeanGroupCode,
      },
    });
    created++;
  }

  console.log(`Created ${created} MandateEuropean records`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
