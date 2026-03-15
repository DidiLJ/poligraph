import { inngest } from "../client";
import { db } from "@/lib/db";

export const syncPlatformUpdates = inngest.createFunction(
  {
    id: "sync-platform-updates",
    retries: 2,
    concurrency: { limit: 1 },
  },
  { cron: "0 4 * * 1" }, // Every Monday at 04:00 UTC (before recap cache warm)
  async ({ step }) => {
    const releases = await step.run("fetch-github-releases", async () => {
      const owner = "ironlam";
      const repo = "poligraph";
      const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;

      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<
        Array<{
          html_url: string;
          name: string | null;
          tag_name: string;
          body: string | null;
          published_at: string;
        }>
      >;
    });

    const created = await step.run("upsert-releases", async () => {
      let count = 0;

      for (const release of releases) {
        const sourceUrl = release.html_url;

        const exists = await db.platformUpdate.findFirst({
          where: { sourceUrl },
          select: { id: true },
        });

        if (exists) continue;

        await db.platformUpdate.create({
          data: {
            title: release.name || release.tag_name,
            description: release.body?.slice(0, 500) || null,
            type: "RELEASE",
            date: new Date(release.published_at),
            sourceUrl,
          },
        });
        count++;
      }

      return count;
    });

    // Cleanup: remove analyzed press articles with no detected mentions
    // (older than 7 days to allow for re-analysis)
    const cleaned = await step.run("cleanup-unlinked-press", async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      const { count } = await db.pressArticle.deleteMany({
        where: {
          aiAnalyzedAt: { not: null, lt: cutoff },
          mentions: { none: {} },
          partyMentions: { none: {} },
        },
      });

      if (count > 0) {
        console.log(`Cleaned up ${count} unlinked press articles`);
      }

      return count;
    });

    return { releasesChecked: releases.length, created, pressArticlesCleaned: cleaned };
  }
);
