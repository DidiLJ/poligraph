/**
 * CLI script to download parliamentary documents and extract the exposé des
 * motifs of legislative dossiers (Assemblée nationale).
 *
 * Usage:
 *   npm run sync:legislation:content              # Sync missing exposés
 *   npm run sync:legislation:content -- --limit=5 # Limit to N dossiers
 *   npm run sync:legislation:content -- --stats   # Show current stats
 *   npm run sync:legislation:content -- --force   # Re-download all
 *   npm run sync:legislation:content -- --dry-run # Preview without writing
 *
 * Data source: www.assemblee-nationale.fr/dyn/opendata (official documents).
 * The download and extraction logic lives in
 * `src/services/sync/legislation-content.ts`, shared with the Inngest job.
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import { syncLegislationContent } from "../src/services/sync/legislation-content";

const handler: SyncHandler = {
  name: "Politic Tracker - Legislative Content Sync",
  description: "Download AN documents and extract their exposé des motifs",

  options: [
    {
      name: "--force",
      type: "boolean",
      description: "Re-download all documents (even already processed)",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Legislative Content Sync

Downloads official documents from www.assemblee-nationale.fr/dyn/opendata and
extracts the "exposé des motifs" section to enrich legislative dossier summaries.

Prerequisites:
  - Run sync:legislation first to populate documentExternalId

Features:
  - Downloads the open data HTML text of AN documents
  - Extracts exposé des motifs via regex
  - Falls back to first 5000 chars if no section found
  - Rate-limited (300ms between requests)
  - Skips 404s silently (document not available)
  - Stops early when the source host no longer resolves
    `);
  },

  async showStats() {
    const total = await db.legislativeDossier.count();
    const withDocId = await db.legislativeDossier.count({
      where: { documentExternalId: { not: null } },
    });
    const withExpose = await db.legislativeDossier.count({
      where: { exposeDesMotifs: { not: null } },
    });
    const pendingDownload = await db.legislativeDossier.count({
      where: {
        documentExternalId: { not: null },
        exposeDesMotifs: null,
      },
    });

    const bySource = await db.legislativeDossier.groupBy({
      by: ["exposeSource"],
      _count: true,
      where: { exposeDesMotifs: { not: null } },
    });

    console.log("\n" + "=".repeat(50));
    console.log("Legislative Content Stats");
    console.log("=".repeat(50));
    console.log(`Total dossiers: ${total}`);
    console.log(`With document ID: ${withDocId}`);
    console.log(
      `With exposé des motifs: ${withExpose} (${total > 0 ? ((withExpose / total) * 100).toFixed(1) : 0}%)`
    );
    console.log(`Pending download: ${pendingDownload}`);

    if (bySource.length > 0) {
      console.log("\nBy source:");
      for (const s of bySource) {
        console.log(`  ${s.exposeSource || "(unknown)"}: ${s._count}`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const {
      dryRun = false,
      limit,
      force = false,
    } = options as {
      dryRun?: boolean;
      limit?: number;
      force?: boolean;
    };

    const { errors, ...stats } = await syncLegislationContent({
      limit,
      force,
      dryRun,
      onProgress: (done, total, documentId) => {
        process.stdout.write(
          `\r[${done}/${total}] Downloading ${documentId}...                    `
        );
      },
    });

    console.log(""); // New line after progress

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
