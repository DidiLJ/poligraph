import { inngest } from "../client";

export const moderationPreflight = inngest.createFunction(
  {
    id: "moderation-preflight",
    name: "Moderation Preflight (daily)",
    retries: 1,
    concurrency: { limit: 1, key: '"moderation-preflight"' },
  },
  { cron: "TZ=Europe/Paris 30 4 * * *" },
  async ({ step }) => {
    const report = await step.run("run-preflight", async () => {
      const { runPreflight } = await import("@/lib/moderation/preflight");
      return runPreflight({ source: "cron" });
    });

    await step.run("persist-report-best-effort", async () => {
      try {
        const { writeFile, mkdir } = await import("fs/promises");
        const path = await import("path");
        const outDir = path.join(process.cwd(), "data");
        await mkdir(outDir, { recursive: true });
        await writeFile(
          path.join(outDir, "moderation-preflight.json"),
          JSON.stringify(report, null, 2)
        );
      } catch (err) {
        console.warn("[preflight cron] could not write JSON (expected on serverless):", err);
      }
    });

    return {
      totalDrafts: report.stats.totalDrafts,
      autoPublishCandidates: report.stats.autoPublishCandidates,
      needsReview: report.stats.needsReview,
      attributionIssues: report.stats.attributionIssues,
      duplicateGroups: report.stats.duplicateGroups,
    };
  }
);
