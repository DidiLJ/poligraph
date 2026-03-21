import "dotenv/config";
import { syncOpenSanctions } from "@/services/sync/opensanctions";
import { db } from "@/lib/db";
import { DataSource } from "@/generated/prisma";

async function showStats() {
  const totalPoliticians = await db.politician.count();
  const withOpenSanctions = await db.externalId.count({
    where: { source: DataSource.OPENSANCTIONS },
  });

  console.log("\n=== OpenSanctions Sync Stats ===");
  console.log(`Total politicians: ${totalPoliticians}`);
  console.log(`With OpenSanctions ID: ${withOpenSanctions}`);
  console.log(`Coverage: ${((withOpenSanctions / totalPoliticians) * 100).toFixed(1)}%`);
  console.log(`Missing: ${totalPoliticians - withOpenSanctions}`);
}

async function main() {
  const args = process.argv.slice(2);
  const isStats = args.includes("--stats");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  if (isStats) {
    await showStats();
    process.exit(0);
  }

  console.log("Starting OpenSanctions sync...");
  if (limit) console.log(`Limit: ${limit} entities`);

  const result = await syncOpenSanctions({ limit });

  console.log("\n=== Results ===");
  console.log(`Downloaded entities: ${result.downloaded}`);
  console.log(`French persons: ${result.frenchFiltered}`);
  console.log(`Matched (auto-linked): ${result.matched}`);
  console.log(`For review: ${result.review}`);
  console.log(`Not found: ${result.notFound}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }

  await showStats();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
