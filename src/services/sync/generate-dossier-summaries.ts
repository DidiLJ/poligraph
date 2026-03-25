/**
 * Orchestration service for generating AI summaries for legislative dossiers.
 */

import { db } from "@/lib/db";
import { generateDossierSummary, type DossierSummaryInput } from "@/services/dossier-summary";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";
import type { DossierTimelineEntry } from "@/types/legislation";

export interface DossierSummariesResult {
  processed: number;
  generated: number;
  skipped: number;
  errors: string[];
}

export async function generateDossierSummaries(options?: {
  limit?: number;
  force?: boolean;
}): Promise<DossierSummariesResult> {
  const { limit = 20, force = false } = options ?? {};

  const stats: DossierSummariesResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};
  if (!force) {
    whereClause.summary = null;
  }

  const dossiers = await db.legislativeDossier.findMany({
    where: whereClause,
    orderBy: { filingDate: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      shortTitle: true,
      number: true,
      category: true,
      status: true,
      filingDate: true,
      exposeDesMotifs: true,
      timeline: true,
      authors: {
        select: {
          role: true,
          politician: { select: { fullName: true } },
        },
      },
      scrutins: {
        select: { title: true },
        orderBy: { votingDate: "desc" },
        take: 5,
      },
      _count: { select: { amendments: true } },
    },
  });

  console.log(`[dossier-summaries] Found ${dossiers.length} dossiers to process`);

  if (dossiers.length === 0) {
    return stats;
  }

  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i]!;

    try {
      const timelineLabels = extractTimelineLabels(
        dossier.timeline as unknown as DossierTimelineEntry[] | null
      );

      const authors = dossier.authors.map(
        (a) => `${a.politician.fullName} (${a.role.toLowerCase()})`
      );

      const input: DossierSummaryInput = {
        title: dossier.title,
        shortTitle: dossier.shortTitle,
        number: dossier.number,
        category: dossier.category,
        status: dossier.status,
        filingDate: dossier.filingDate?.toISOString().split("T")[0] ?? null,
        exposeDesMotifs: dossier.exposeDesMotifs,
        timelineLabels,
        authors,
        scrutinTitles: dossier.scrutins.map((s) => s.title),
        amendmentCount: dossier._count.amendments,
      };

      const result = await generateDossierSummary(input);

      if (result.confidence < 40 || !result.summary) {
        console.log(
          `[dossier-summaries] Skipped (confidence ${result.confidence}): ${dossier.title.slice(0, 60)}`
        );
        stats.skipped++;
        stats.processed++;
        continue;
      }

      await db.legislativeDossier.update({
        where: { id: dossier.id },
        data: {
          summary: result.summary,
          summaryDate: new Date(),
        },
      });

      console.log(
        `[dossier-summaries] Generated (confidence ${result.confidence}): ${dossier.title.slice(0, 60)}`
      );
      stats.generated++;
      stats.processed++;

      if (i < dossiers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${dossier.title.slice(0, 50)}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("[dossier-summaries] Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  return stats;
}

function extractTimelineLabels(timeline: DossierTimelineEntry[] | null): string[] {
  if (!timeline) return [];
  const labels: string[] = [];
  for (const entry of timeline) {
    if (entry.label) labels.push(entry.label);
    if (entry.children) {
      for (const child of entry.children) {
        if (child.label && child.date) labels.push(child.label);
      }
    }
  }
  return labels;
}

// CLI entry point
if (process.argv[1]?.includes("generate-dossier-summaries")) {
  const force = process.argv.includes("--force");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : 20;

  generateDossierSummaries({ limit, force })
    .then((result) => {
      console.log("\n[dossier-summaries] Done:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[dossier-summaries] Fatal:", err);
      process.exit(1);
    });
}
