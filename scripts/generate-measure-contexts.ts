import { getMistralTokensUsed } from "../src/lib/api/mistral";
import { db } from "../src/lib/db";
import {
  findMeasureContextCandidateIds,
  generateMeasureContextDraft,
} from "../src/lib/measures/context-generation";

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
  const eligibleIds = await findMeasureContextCandidateIds(options.electionSlug, options.limit);

  console.log(`${eligibleIds.length} mesure(s) éligible(s) dans ce lot.`);
  if (!options.apply) {
    console.log("Simulation uniquement. Ajouter --apply pour créer les brouillons.");
    return;
  }
  if (!process.env.MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY doit être définie dans .env");

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const measureId of eligibleIds) {
    try {
      const result = await generateMeasureContextDraft(measureId, { generatedBy: "cli" });
      if (result.status === "CREATED") {
        created += 1;
        console.log(`${measureId}: brouillon ${result.revisionId} créé`);
      } else {
        skipped += 1;
        console.log(`${measureId}: ignorée (${result.reason})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`${measureId}: ${error instanceof Error ? error.message : String(error)}`);
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
