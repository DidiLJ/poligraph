import { db } from "@/lib/db";
import { promoteMayor } from "@/services/admin/promote-mayor";

const MIN_POPULATION = parseInt(process.argv[2] || "50000", 10);
const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  console.log(
    `Promotion des maires de communes > ${MIN_POPULATION.toLocaleString()} hab.` +
      (DRY_RUN ? " (DRY RUN)" : " (APPLY)")
  );

  const candidates = await db.localOfficial.findMany({
    where: {
      role: "MAIRE",
      isCurrent: true,
      politicianId: null,
      commune: { population: { gte: MIN_POPULATION } },
    },
    include: {
      commune: { select: { name: true, population: true, departmentCode: true } },
    },
    orderBy: { commune: { population: "desc" } },
  });

  console.log(`${candidates.length} maires eligibles\n`);

  if (DRY_RUN) {
    for (const c of candidates) {
      console.log(
        `  ${c.fullName.padEnd(30)} ${(c.commune?.name ?? "").padEnd(25)} ${String(c.commune?.population ?? 0).padStart(8)} hab.`
      );
    }
    console.log("\nAjouter --apply pour executer.");
    return;
  }

  let success = 0;
  let errors = 0;

  for (const c of candidates) {
    try {
      const result = await promoteMayor(c.id);
      console.log(
        `OK  ${c.fullName.padEnd(30)} -> ${result.slug} (Wikidata: ${result.wikidataId ?? "aucun"})`
      );
      success++;
    } catch (err) {
      console.error(
        `ERR ${c.fullName.padEnd(30)} ${err instanceof Error ? err.message : String(err)}`
      );
      errors++;
    }
  }

  console.log(`\nTermine: ${success} promus, ${errors} erreurs.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
