import { getMistralTokensUsed } from "../src/lib/api/mistral";
import { db } from "../src/lib/db";
import { readEvidenceSnapshot } from "../src/lib/measures/evidence-snapshot";
import { generateMeasureContextDraft } from "../src/lib/measures/context-generation";

type Options = { apply: boolean; electionSlug: string; limit: number };

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function parseOptions(args: string[]): Options {
  const limit = Number(valueAfter(args, "--limit") ?? "30");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("--limit doit être un entier compris entre 1 et 100");
  }
  return {
    apply: args.includes("--apply"),
    electionSlug: valueAfter(args, "--election") ?? "presidentielle-2027",
    limit,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const candidates = await db.measure.findMany({
    where: {
      election: { slug: options.electionSlug },
      publicationStatus: "PUBLISHED",
      publishedRevision: { is: { details: null } },
    },
    select: {
      id: true,
      latestRevisionId: true,
      publishedRevisionId: true,
      publishedRevision: { select: { evidenceSnapshot: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 5_000,
  });
  const eligible = candidates
    .filter((measure) => measure.latestRevisionId === measure.publishedRevisionId)
    .filter((measure) => {
      const evidence = readEvidenceSnapshot(measure.publishedRevision?.evidenceSnapshot);
      return evidence.status === "VALID" && evidence.snapshot.supportingIds.length > 0;
    })
    .slice(0, options.limit);

  console.log(`${eligible.length} mesure(s) éligible(s) dans ce lot.`);
  if (!options.apply) {
    console.log("Simulation uniquement. Ajouter --apply pour créer les brouillons.");
    return;
  }
  if (!process.env.MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY doit être définie dans .env");

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const measure of eligible) {
    try {
      const result = await generateMeasureContextDraft(measure.id, { generatedBy: "cli" });
      if (result.status === "CREATED") {
        created += 1;
        console.log(`${measure.id}: brouillon ${result.revisionId} créé`);
      } else {
        skipped += 1;
        console.log(`${measure.id}: ignorée (${result.reason})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`${measure.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(
    `${created} brouillon(s), ${skipped} ignorée(s), ${failed} erreur(s), ${getMistralTokensUsed()} tokens Mistral.`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
