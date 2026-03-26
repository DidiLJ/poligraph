/**
 * Backfill script: fix Sénat PPL DossierAuthor roles.
 *
 * The Sénat CSV lists all names (author + cosignataires) in a single "Auteurs"
 * column. The sync previously marked ALL of them as AUTEUR. This script fixes
 * that by keeping only the first 2 AUTEURs per dossier (the depositors) and
 * changing the rest to COSIGNATAIRE.
 *
 * Also promotes the 2nd entry to AUTEUR if it was already changed to COSIGNATAIRE.
 *
 * Only affects Sénat PPL authors (chamber=SENAT, no acteurRef).
 * Rapporteurs are not touched.
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/backfill-senat-cosignataires.ts [--dry]
 */

import { db } from "@/lib/db";

const DRY_RUN = process.argv.includes("--dry");

async function main() {
  console.log(`=== Backfill Sénat cosignataires ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // Find all dossiers with Sénat authors (no acteurRef = came from CSV sync)
  const dossierIds = await db.$queryRaw<{ dossierId: string }[]>`
    SELECT DISTINCT "dossierId"
    FROM "DossierAuthor"
    WHERE chamber = 'SENAT'
      AND "acteurRef" IS NULL
    ORDER BY "dossierId"
  `;

  console.log(`Found ${dossierIds.length} dossiers with Sénat authors\n`);

  let promoted = 0;
  let demoted = 0;
  let skipped = 0;

  for (const { dossierId } of dossierIds) {
    // Get ALL Sénat entries for this dossier, ordered by creation time
    // (preserves the CSV order from the original sync)
    const all = await db.dossierAuthor.findMany({
      where: {
        dossierId,
        chamber: "SENAT",
        acteurRef: null,
      },
      orderBy: { id: "asc" }, // cuid is time-sortable
      select: {
        id: true,
        politicianId: true,
        role: true,
        politician: { select: { fullName: true } },
      },
    });

    if (all.length <= 2) {
      // Ensure both are AUTEUR
      for (const entry of all) {
        if (entry.role !== "AUTEUR") {
          if (!DRY_RUN) {
            await db.dossierAuthor.delete({ where: { id: entry.id } });
            await db.dossierAuthor.create({
              data: {
                dossierId,
                politicianId: entry.politicianId,
                role: "AUTEUR",
                chamber: "SENAT",
              },
            });
          }
          console.log(`  Promoted ${entry.politician.fullName} → AUTEUR`);
          promoted++;
        }
      }
      continue;
    }

    // First 2 = AUTEUR, rest = COSIGNATAIRE
    const first2 = all.slice(0, 2);
    const rest = all.slice(2);

    let changed = false;

    // Promote first 2 to AUTEUR if needed
    for (const entry of first2) {
      if (entry.role !== "AUTEUR") {
        if (!DRY_RUN) {
          await db.dossierAuthor.delete({ where: { id: entry.id } });
          await db.dossierAuthor.create({
            data: {
              dossierId,
              politicianId: entry.politicianId,
              role: "AUTEUR",
              chamber: "SENAT",
            },
          });
        }
        promoted++;
        changed = true;
      }
    }

    // Demote rest to COSIGNATAIRE if needed
    for (const entry of rest) {
      if (entry.role !== "COSIGNATAIRE") {
        if (!DRY_RUN) {
          // Check for existing COSIGNATAIRE entry to avoid unique constraint
          const existing = await db.dossierAuthor.findUnique({
            where: {
              dossierId_politicianId_role: {
                dossierId,
                politicianId: entry.politicianId,
                role: "COSIGNATAIRE",
              },
            },
          });
          await db.dossierAuthor.delete({ where: { id: entry.id } });
          if (!existing) {
            await db.dossierAuthor.create({
              data: {
                dossierId,
                politicianId: entry.politicianId,
                role: "COSIGNATAIRE",
                chamber: "SENAT",
              },
            });
          }
        }
        demoted++;
        changed = true;
      }
    }

    if (changed) {
      console.log(
        `Dossier ${dossierId}: ${first2.map((a) => a.politician.fullName).join(", ")} (AUTEUR) + ${rest.length} COSIGNATAIRE`
      );
    } else {
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Dossiers checked: ${dossierIds.length}`);
  console.log(`Promoted to AUTEUR: ${promoted}`);
  console.log(`Demoted to COSIGNATAIRE: ${demoted}`);
  console.log(`Already correct: ${skipped}`);
  if (DRY_RUN) console.log("\n(Dry run - no changes made)");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
