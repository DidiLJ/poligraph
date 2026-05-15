import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncFactchecksGrouped = inngest.createFunction(
  {
    id: "sync-factchecks",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-factchecks"' },
  },
  { event: "sync/factchecks" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      const fcStats = await step.run("factchecks", async () => {
        const { syncFactchecks } = await import("@/services/sync/factchecks");
        const stats = await syncFactchecks({ limit: 50 });
        if (jobId) await updateJobProgress(jobId, 100);
        return stats;
      });

      // Judilibre step disabled 2026-05-15 (Option C, audit:
      // docs/superpowers/audits/2026-05-15-judilibre-no-match-audit.md).
      // The Cassation chambre criminelle corpus is structurally anonymized;
      // pipeline produced 0 affairs over 156 decisions. Re-enabling tracked
      // as Option D (enrichment for existing affairs) in follow-up issue.
      // const jStats = await step.run("judilibre", async () => {
      //   const { syncJudilibre } = await import("@/services/sync/judilibre");
      //   return syncJudilibre({ limit: 20 });
      // });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["factchecks"],
          factchecksStats: fcStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
