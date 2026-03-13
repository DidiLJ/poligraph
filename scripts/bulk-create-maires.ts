import "dotenv/config";
import { bulkCreateMaires } from "../src/services/admin/bulk-create-maires.js";
import { db } from "../src/lib/db.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitFlag = args.find((a) => a.startsWith("--limit="));
  const limit = limitFlag ? parseInt(limitFlag.split("=")[1]!, 10) : undefined;

  console.log(`\n=== Bulk Create Maires ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log("");

  const stats = await bulkCreateMaires({ dryRun, limit });

  console.log(`\n=== Final Stats ===`);
  console.log(JSON.stringify(stats, null, 2));

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
