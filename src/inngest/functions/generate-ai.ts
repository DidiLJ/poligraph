import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed } from "../job-helper";

export const generateAi = inngest.createFunction(
  {
    id: "generate-ai",
    retries: 2,
    concurrency: { limit: 1, key: '"generate-ai"' },
  },
  { event: "sync/generate-ai" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      const themeStats = await step.run("classify-themes", async () => {
        const { classifyThemes } = await import("@/services/sync/classify-themes");
        return classifyThemes({ limit: 30 });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["classify-themes"],
          themeStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
