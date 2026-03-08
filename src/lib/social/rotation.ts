import { db } from "@/lib/db";
import { CATEGORY_PRIORITY, METHODO_COOLDOWN_DAYS } from "./config";
import type { SocialCategory } from "./config";
import { getRecentlyPosted } from "./dedup";
import { generateForCategory, type TweetDraft } from "./generators";

/**
 * Generate the best 2-3 drafts across all categories.
 * Returns drafts sorted by priority.
 */
export async function generateBatchDrafts(
  maxDrafts = 3
): Promise<{ category: SocialCategory; draft: TweetDraft }[]> {
  const recent = await getRecentlyPosted();
  const results: { category: SocialCategory; draft: TweetDraft }[] = [];

  // Check methodo cooldown
  const methodoSince = new Date();
  methodoSince.setDate(methodoSince.getDate() - METHODO_COOLDOWN_DAYS);
  const recentMethodo = await db.socialPost.count({
    where: {
      category: "methodo",
      createdAt: { gte: methodoSince },
      status: { in: ["PENDING_REVIEW", "APPROVED", "POSTED"] },
    },
  });

  for (const category of CATEGORY_PRIORITY) {
    if (results.length >= maxDrafts) break;
    if (category === "methodo" && recentMethodo > 0) continue;

    try {
      const draft = await generateForCategory(category, recent);
      if (draft) {
        results.push({ category, draft });
      }
    } catch {
      // Skip failed generators
    }
  }

  return results;
}
