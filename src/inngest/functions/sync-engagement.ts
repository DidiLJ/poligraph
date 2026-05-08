import { inngest } from "../client";

export const syncEngagement = inngest.createFunction(
  {
    id: "newsletter/sync-engagement",
    retries: 2,
    concurrency: { limit: 1, key: '"newsletter-engagement"' },
  },
  { cron: "0 12 * * 1" },
  async ({ step }) => {
    const enabled = await step.run("check-enabled", async () => {
      return process.env.NEWSLETTER_ENABLED === "true";
    });
    if (!enabled) {
      return { status: "skipped", reason: "NEWSLETTER_ENABLED is not true" };
    }

    const editions = await step.run("load-editions", async () => {
      const { db } = await import("@/lib/db");
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      return db.newsletterEdition.findMany({
        where: { sentAt: { gte: fourWeeksAgo, not: null } },
        select: { id: true, weekStart: true },
        orderBy: { weekStart: "desc" },
      });
    });

    let processed = 0;
    for (const edition of editions) {
      await step.run(`stats-${edition.id}`, async () => {
        const { fetchMailjetStatsForCampaign } = await import("@/lib/email/mailjet");
        const { db } = await import("@/lib/db");
        const stats = await fetchMailjetStatsForCampaign(new Date(edition.weekStart));
        await db.newsletterEditionStats.upsert({
          where: { editionId: edition.id },
          create: {
            editionId: edition.id,
            ...stats,
            topClicks: stats.topClicks as never,
            syncedAt: new Date(),
          },
          update: {
            ...stats,
            topClicks: stats.topClicks as never,
            syncedAt: new Date(),
          },
        });
      });
      processed += 1;
    }

    return { status: "synced", editionsProcessed: processed };
  }
);
