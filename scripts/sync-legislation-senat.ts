/**
 * CLI script to sync Senate legislative data (PPL authors + rapporteurs).
 *
 * Usage:
 *   npm run sync:legislation:senat         # Full sync
 *   npm run sync:legislation:senat:stats   # Show current stats
 *
 * Data source: data.gouv.fr (Senate open data CSVs)
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";

const handler: SyncHandler = {
  name: "Politic Tracker - Senate Legislation Sync",
  description: "Import PPL authors and rapporteurs from Senate CSVs (data.gouv.fr)",

  options: [],

  showHelp() {
    console.log(`
Politic Tracker - Senate Legislation Sync

Data source: data.gouv.fr (Senate open data CSVs)
  - PPL (propositions de loi): authors of Senate-originated bills
  - Rapports: commission rapporteurs

Prerequisites:
  - Legislative dossiers must be synced first (npm run sync:legislation)
  - Dossiers with senatUrl are matched by URL; others by title fallback
    `);
  },

  async showStats() {
    const totalAuthors = await db.dossierAuthor.count();
    const byRole = await db.dossierAuthor.groupBy({
      by: ["role"],
      _count: true,
      orderBy: { _count: { role: "desc" } },
    });
    const byChamber = await db.dossierAuthor.groupBy({
      by: ["chamber"],
      _count: true,
      orderBy: { _count: { chamber: "desc" } },
    });
    const dossiersWithSenatUrl = await db.legislativeDossier.count({
      where: { senatUrl: { not: null } },
    });
    const dossiersWithAuthors = await db.dossierAuthor
      .groupBy({ by: ["dossierId"] })
      .then((g) => g.length);

    console.log("\n" + "=".repeat(50));
    console.log("Senate Legislation Sync Stats");
    console.log("=".repeat(50));
    console.log(`Total DossierAuthor records: ${totalAuthors}`);
    console.log(`Dossiers with authors: ${dossiersWithAuthors}`);
    console.log(`Dossiers with senatUrl: ${dossiersWithSenatUrl}`);

    if (byRole.length > 0) {
      console.log("\nBy role:");
      for (const r of byRole) {
        console.log(`  ${r.role}: ${r._count}`);
      }
    }

    if (byChamber.length > 0) {
      console.log("\nBy chamber:");
      for (const c of byChamber) {
        console.log(`  ${c.chamber || "(null)"}: ${c._count}`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false } = options as { dryRun?: boolean };

    if (dryRun) {
      console.log("Dry run: would download and parse Senate CSVs");
      return { success: true, duration: 0, stats: {}, errors: [] };
    }

    const { syncLegislationSenat } = await import("../src/services/sync/legislation-senat");
    const result = await syncLegislationSenat();

    console.log("\n" + "=".repeat(50));
    console.log("Senate Legislation Sync Complete");
    console.log("=".repeat(50));
    console.log(`PPL authors created: ${result.ppl.authorsCreated}`);
    console.log(`Rapporteurs created: ${result.rapports.authorsCreated}`);
    console.log(`PPL dossiers matched: ${result.ppl.dossiersMatched}`);
    console.log(`Rapport dossiers matched: ${result.rapports.dossiersMatched}`);
    console.log(`Senators resolved (ExternalId): ${result.resolution.senatIdMatched}`);
    console.log(`Senators resolved (batch): ${result.resolution.batchMatched}`);
    console.log(`Senators not resolved: ${result.resolution.notResolved}`);

    const allErrors = [...result.ppl.errors, ...result.rapports.errors];
    if (allErrors.length > 0) {
      console.log(`\nErrors (${allErrors.length}):`);
      for (const e of allErrors.slice(0, 10)) {
        console.log(`  - ${e}`);
      }
    }

    return {
      success: allErrors.length === 0,
      duration: 0,
      stats: {
        pplAuthors: result.ppl.authorsCreated,
        rapporteurs: result.rapports.authorsCreated,
        dossiersMatched: result.ppl.dossiersMatched + result.rapports.dossiersMatched,
        senatorsResolved: result.resolution.senatIdMatched + result.resolution.batchMatched,
      },
      errors: allErrors,
    };
  },
};

createCLI(handler);
