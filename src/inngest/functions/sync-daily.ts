import { inngest } from "../client";

interface DailyStep {
  name: string;
  run: () => Promise<unknown>;
}

const DAILY_STEPS: DailyStep[] = [
  {
    name: "scrutins-an",
    run: async () => {
      const { syncScrutinsAN } = await import("@/services/sync/scrutins-an");
      return syncScrutinsAN(undefined, false, true);
    },
  },
  {
    name: "scrutins-senat",
    run: async () => {
      const { syncScrutinsSenat } = await import("@/services/sync/scrutins-senat");
      return syncScrutinsSenat(null, false, true);
    },
  },
  {
    name: "legislation",
    run: async () => {
      const { syncLegislation } = await import("@/services/sync/legislation");
      return syncLegislation({ activeOnly: true });
    },
  },
  {
    name: "legislation-content",
    run: async () => {
      const { syncLegislationContent } = await import("@/services/sync/legislation-content");
      return syncLegislationContent({ limit: 20 });
    },
  },
  {
    name: "summaries-dossiers",
    run: async () => {
      if (!process.env.MISTRAL_API_KEY) return { skipped: "no MISTRAL_API_KEY" };
      const { generateDossierSummaries } =
        await import("@/services/sync/generate-dossier-summaries");
      return generateDossierSummaries({ limit: 10 });
    },
  },
  {
    name: "reconcile-scrutin-dossier",
    run: async () => {
      const { reconcileScrutinDossier } = await import("@/services/sync/reconcile-scrutin-dossier");
      return reconcileScrutinDossier();
    },
  },
  {
    name: "press-rss",
    run: async () => {
      const { syncPress } = await import("@/services/sync/press");
      return syncPress();
    },
  },
  {
    name: "press-analysis",
    run: async () => {
      const { syncPressAnalysis } = await import("@/services/sync/press-analysis");
      return syncPressAnalysis({ limit: 100 });
    },
  },
  {
    name: "judilibre",
    run: async () => {
      const { syncJudilibre } = await import("@/services/sync/judilibre");
      return syncJudilibre({ limit: 20 });
    },
  },
  {
    name: "reconcile-affairs",
    run: async () => {
      const { reconcileAffairs } = await import("@/services/sync/reconcile-affairs");
      return reconcileAffairs({ autoMerge: true });
    },
  },
  {
    name: "factchecks",
    run: async () => {
      const { syncFactchecks } = await import("@/services/sync/factchecks");
      return syncFactchecks({ limit: 50 });
    },
  },
  {
    name: "classify-themes",
    run: async () => {
      const { classifyThemes } = await import("@/services/sync/classify-themes");
      return classifyThemes({ limit: 30 });
    },
  },
  {
    name: "compute-importance-scores",
    run: async () => {
      const { computeImportanceScores } = await import("@/services/sync/scrutin-importance");
      return computeImportanceScores();
    },
  },
  {
    name: "compute-group-positions",
    run: async () => {
      const { computeGroupPositions } = await import("@/services/sync/compute-group-positions");
      const since = new Date();
      since.setDate(since.getDate() - 7);
      return computeGroupPositions({ since });
    },
  },
  {
    name: "sync-debate-transcripts",
    run: async () => {
      const { syncDebateTranscripts } = await import("@/services/sync/debate-transcripts");
      return syncDebateTranscripts();
    },
  },
  {
    name: "generate-scrutin-summaries",
    run: async () => {
      if (!process.env.MISTRAL_API_KEY) return { skipped: "no MISTRAL_API_KEY" };
      const { generateScrutinSummaries } =
        await import("@/services/sync/generate-scrutin-summaries");
      return generateScrutinSummaries({ limit: 30 });
    },
  },
  {
    name: "generate-citizen-impacts",
    run: async () => {
      if (!process.env.MISTRAL_API_KEY) return { skipped: "no MISTRAL_API_KEY" };
      const { generateScrutinCitizenImpacts } =
        await import("@/services/sync/generate-scrutin-citizen-impacts");
      return generateScrutinCitizenImpacts({ limit: 30 });
    },
  },
  {
    name: "generate-scrutin-analysis",
    run: async () => {
      if (!process.env.MISTRAL_API_KEY) return { skipped: "no MISTRAL_API_KEY" };
      const { generateScrutinAnalysis } = await import("@/services/sync/scrutin-analysis");
      return generateScrutinAnalysis({ limit: 5 });
    },
  },
  {
    name: "compute-group-stats",
    run: async () => {
      const { computeGroupStats } = await import("@/services/sync/compute-group-stats");
      return computeGroupStats();
    },
  },
  {
    name: "embeddings-factchecks",
    run: async () => {
      const { indexAllOfType } = await import("@/services/embeddings");
      return indexAllOfType("FACTCHECK", { deltaOnly: true });
    },
  },
  {
    name: "embeddings-press",
    run: async () => {
      const { indexAllOfType } = await import("@/services/embeddings");
      return indexAllOfType("PRESS_ARTICLE", { deltaOnly: true });
    },
  },
  {
    name: "opensanctions-incremental",
    run: async () => {
      if (!process.env.OPENSANCTIONS_API_KEY) return { skipped: "no API key" };
      const { syncOpenSanctionsIncremental } = await import("@/services/sync/opensanctions");
      return syncOpenSanctionsIncremental({ limit: 100 });
    },
  },
  {
    name: "prominence",
    run: async () => {
      const { recalculateProminence } = await import("@/services/sync/prominence");
      return recalculateProminence();
    },
  },
  {
    name: "publication-status",
    run: async () => {
      const { assignPublicationStatus } = await import("@/services/sync/publication-status");
      return assignPublicationStatus();
    },
  },
  {
    name: "compute-stats",
    run: async () => {
      const { computeStats } = await import("@/services/sync/compute-stats");
      return computeStats();
    },
  },
  {
    name: "compute-municipales-snapshots",
    run: async () => {
      const { computeMunicipalesSnapshots } =
        await import("@/services/sync/compute-municipales-snapshots");
      return computeMunicipalesSnapshots();
    },
  },
  {
    name: "indexnow",
    run: async () => {
      const { submitRecentToIndexNow } = await import("@/lib/indexnow");
      return submitRecentToIndexNow();
    },
  },
];

export const syncDaily = inngest.createFunction(
  {
    id: "sync-daily",
    retries: 0,
    concurrency: { limit: 1 },
  },
  [{ cron: "0 5,11,19 * * *" }, { event: "sync/daily" }],
  async ({ step }) => {
    const results: Array<{
      name: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const s of DAILY_STEPS) {
      const result = await step.run(s.name, async () => {
        try {
          await s.run();
          return { success: true as const };
        } catch (err) {
          // Don't throw — continue to next step
          return {
            success: false as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });

      results.push({ name: s.name, ...result });
    }

    const failed = results.filter((r) => !r.success);
    return {
      total: results.length,
      succeeded: results.length - failed.length,
      failed: failed.length,
      failures: failed.map((f) => f.name),
    };
  }
);
