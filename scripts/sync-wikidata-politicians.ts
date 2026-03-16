/**
 * CLI script to import French politicians from Wikidata
 *
 * Usage:
 *   npm run sync:wikidata-politicians              # Full import
 *   npm run sync:wikidata-politicians -- --stats    # Show current stats
 *   npm run sync:wikidata-politicians -- --dry-run  # Preview without saving
 *   npm run sync:wikidata-politicians -- --limit 50 # Limit to 50 new profiles
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import {
  syncWikidataPoliticians,
  getWikidataPoliticiansStats,
} from "../src/services/sync/wikidata-politicians";

const handler: SyncHandler = {
  name: "Poligraph - Wikidata Politicians Import",
  description: "Import notable French politicians from Wikidata SPARQL",

  showHelp() {
    console.log(`
Poligraph - Wikidata Politicians Import

This script imports politicians not yet in the database:
  1. Current regional presidents (P39=Q19546)
  2. Current departmental presidents (P39=Q1805817)
  3. Notable former deputies/senators/ministers (with French Wikipedia article)

Deduplication: skips any Q-ID already in ExternalId table.
New profiles are created as DRAFT. Run enrichment syncs after:
  npm run sync:photos && npm run sync:careers
    `);
  },

  async showStats() {
    const stats = await getWikidataPoliticiansStats();

    console.log("\n" + "=".repeat(50));
    console.log("Wikidata Politicians Stats");
    console.log("=".repeat(50));
    console.log(`Total politicians: ${stats.total}`);
    console.log(`With Wikidata ID: ${stats.withWikidata}`);
    console.log(`Without Wikidata ID: ${stats.total - stats.withWikidata}`);
    console.log(`Current DRAFT profiles: ${stats.draftCount}`);
    console.log(`Current regional presidents: ${stats.regionPresidents}`);
    console.log(`Current departmental presidents: ${stats.deptPresidents}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit } = options;

    const result = await syncWikidataPoliticians({
      dryRun,
      limit: limit as number | undefined,
    });

    return {
      success: result.errors.length === 0,
      duration: 0,
      stats: {
        queriedRegional: result.queriedRegional,
        queriedDepartmental: result.queriedDepartmental,
        queriedFormerNationals: result.queriedFormerNationals,
        alreadyInDb: result.alreadyInDb,
        created: result.created,
        mandatesCreated: result.mandatesCreated,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
