import { inngest } from "../client";

/** Generate 2-3 drafts every morning (+ afternoon fallback) */
export const generateSocialDrafts = inngest.createFunction(
  {
    id: "social/generate-drafts",
    retries: 1,
    concurrency: { limit: 1, key: '"social-generate"' },
  },
  [
    { cron: "0 6 * * *" }, // 06:00 UTC = 07:00 Paris
    { cron: "0 14 * * *" }, // 14:00 UTC = 15:00 Paris (fallback)
  ],
  async ({ step }) => {
    const drafts = await step.run("generate-batch", async () => {
      const { generateBatchDrafts } = await import("@/lib/social/rotation");
      return generateBatchDrafts(3);
    });

    if (drafts.length === 0) {
      return { status: "skipped", reason: "no content generated" };
    }

    const postIds = await step.run("save-drafts", async () => {
      const { db } = await import("@/lib/db");
      const { notifySlackReview } = await import("@/lib/social/notify");
      const { extractEntityId } = await import("@/lib/social/dedup");
      const ids: string[] = [];

      for (const { category, draft } of drafts) {
        const post = await db.socialPost.create({
          data: {
            category,
            content: draft.content,
            link: draft.link,
            entityId: draft.entityId ?? extractEntityId(draft.link),
            status: "PENDING_REVIEW",
          },
        });
        ids.push(post.id);

        await notifySlackReview({
          id: post.id,
          category,
          content: draft.content,
          link: draft.link,
        });
      }

      return ids;
    });

    return {
      status: "queued_review",
      count: postIds.length,
      categories: drafts.map((d) => d.category),
    };
  }
);

/** Publish next approved post every 15 minutes */
export const publishApprovedPost = inngest.createFunction(
  {
    id: "social/publish-approved",
    retries: 2,
    concurrency: { limit: 1, key: '"social-publish"' },
  },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const result = await step.run("publish-next", async () => {
      const { db } = await import("@/lib/db");
      const { isAutoPostEnabled } = await import("@/lib/social/config");
      const { postToBothPlatforms } = await import("@/lib/social/post");

      const next = await db.socialPost.findFirst({
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
      });

      if (!next) return { status: "nothing_to_publish" };

      if (!isAutoPostEnabled()) {
        return { status: "dry_run", id: next.id };
      }

      const postResult = await postToBothPlatforms(next.content, next.link ?? undefined);
      const status = postResult.blueskyUrl || postResult.twitterUrl ? "POSTED" : "FAILED";
      const error = [postResult.blueskyError, postResult.twitterError].filter(Boolean).join("; ");

      await db.socialPost.update({
        where: { id: next.id },
        data: {
          status,
          blueskyUrl: postResult.blueskyUrl,
          twitterUrl: postResult.twitterUrl,
          error: error || null,
          postedAt: status === "POSTED" ? new Date() : null,
        },
      });

      return {
        status: status.toLowerCase(),
        id: next.id,
        blueskyUrl: postResult.blueskyUrl,
        twitterUrl: postResult.twitterUrl,
      };
    });

    return result;
  }
);
