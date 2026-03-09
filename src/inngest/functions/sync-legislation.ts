import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncLegislation = inngest.createFunction(
  {
    id: "sync-legislation",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-legislation"' },
  },
  { event: "sync/legislation" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      const legStats = await step.run("legislation", async () => {
        const { syncLegislation: syncLegislationService } =
          await import("@/services/sync/legislation");
        const result = await syncLegislationService({ activeOnly: true });
        if (jobId) await updateJobProgress(jobId, 33);
        return result;
      });

      const contentStats = await step.run("legislation-content", async () => {
        const { syncLegislationContent } = await import("@/services/sync/legislation-content");
        const result = await syncLegislationContent({ limit: 20 });
        if (jobId) await updateJobProgress(jobId, 66);
        return result;
      });

      const senatStats = await step.run("legislation-senat", async () => {
        const { syncLegislationSenat } = await import("@/services/sync/legislation-senat");
        return syncLegislationSenat();
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["legislation", "legislation-content", "legislation-senat"],
          legStats,
          contentStats,
          senatStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
