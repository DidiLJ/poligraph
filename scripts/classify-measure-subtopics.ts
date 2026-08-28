import { db } from "../src/lib/db";
import {
  proposeMeasureRevisionSubtopics,
  syncMeasureSubtopicTaxonomy,
} from "../src/lib/measures/subtopics";

type Options = {
  electionSlug: string;
  candidateSlug?: string;
  limit: number;
  dryRun: boolean;
  force: boolean;
};

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function parseOptions(args: string[]): Options {
  const rawLimit = Number(valueAfter(args, "--limit") ?? "50");
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 500) {
    throw new Error("--limit doit être un entier compris entre 1 et 500");
  }
  return {
    electionSlug: valueAfter(args, "--election") ?? "presidentielle-2027",
    candidateSlug: valueAfter(args, "--candidate"),
    limit: rawLimit,
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const rows = await db.measure.findMany({
    where: {
      election: { slug: options.electionSlug },
      ...(options.candidateSlug
        ? { candidacy: { is: { politician: { is: { slug: options.candidateSlug } } } } }
        : {}),
      publishedRevisionId: { not: null },
      ...(!options.force
        ? {
            publishedRevision: {
              is: { subtopics: { none: {} } },
            },
          }
        : {}),
    },
    select: { id: true, publishedRevisionId: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: options.limit,
  });

  console.log(`${rows.length} révisions à traiter${options.dryRun ? " en simulation" : ""}.`);
  if (!options.dryRun) await syncMeasureSubtopicTaxonomy();
  let proposed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.publishedRevisionId) continue;
    try {
      const result = await proposeMeasureRevisionSubtopics(row.publishedRevisionId, {
        dryRun: options.dryRun,
        proposedBy: "cli",
        skipTaxonomySync: true,
      });
      if (result.skipped) {
        skipped += 1;
        console.log(`${row.id}: ignorée, validation humaine déjà présente.`);
      } else {
        proposed += result.suggestions.length;
        const labels = result.suggestions.map((item) => item.slug).join(", ") || "aucune";
        console.log(`${row.id}: ${labels}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`${proposed} propositions, ${skipped} ignorées, ${failed} erreurs.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
