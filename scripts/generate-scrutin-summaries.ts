import "dotenv/config";
import { generateScrutinSummaries } from "../src/services/sync/generate-scrutin-summaries";
import { db } from "../src/lib/db";

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : 20;

async function main() {
  console.log("============================================================");
  console.log("Generate Scrutin Summaries");
  console.log("============================================================");
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`Limit: ${limit}`);
  console.log(`Force: ${force}`);
  console.log("");

  if (dryRun) {
    console.log("[DRY-RUN] Would generate summaries for up to", limit, "scrutins.");
    return;
  }

  const result = await generateScrutinSummaries({ limit, force });

  console.log("");
  console.log("==================================================");
  console.log("Sync Results:");
  console.log("==================================================");
  console.log(`Processed: ${result.processed}`);
  console.log(`Generated: ${result.generated}`);
  console.log(`Skipped:   ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    for (const err of result.errors.slice(0, 10)) console.log(`  - ${err}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
