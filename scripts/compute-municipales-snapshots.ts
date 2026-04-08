/**
 * CLI runner for the municipales-2026 snapshot pre-computation.
 *
 * Usage:
 *   npm run sync:municipales-snapshots
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { computeMunicipalesSnapshots } from "@/services/sync/compute-municipales-snapshots";

async function main() {
  console.log("Computing municipales-2026 snapshots...");
  const t0 = Date.now();
  try {
    const result = await computeMunicipalesSnapshots();
    console.log(`\nDone in ${result.totalDurationMs}ms`);
    console.log(`Computed ${result.computed.length} snapshots:`);
    for (const s of result.computed) {
      console.log(`  - ${s}`);
    }
  } catch (err) {
    console.error("FAILED:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
  console.log(`\nTotal wall-clock: ${Date.now() - t0}ms`);
}

main();
