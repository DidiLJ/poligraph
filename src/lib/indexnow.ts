import { SITE_URL } from "@/config/site";
import { db } from "@/lib/db";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Submit URLs to IndexNow for faster indexing on Bing, Yandex, Naver, Seznam.
 * Does nothing if INDEXNOW_KEY is not set.
 *
 * Setup:
 * - Set INDEXNOW_KEY env var (UUID format) on Vercel
 * - Create a file `public/{key}.txt` containing the key for verification
 *
 * @see https://www.indexnow.org/documentation
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  const host = new URL(SITE_URL).host;

  // IndexNow accepts max 10,000 URLs per request
  const BATCH_SIZE = 10000;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${SITE_URL}/${key}.txt`,
          urlList: batch,
        }),
      });

      if (!response.ok && response.status !== 202) {
        console.error(`[IndexNow] Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("[IndexNow] Submission failed:", error);
    }
  }
}

/**
 * Query DB for recently changed content and submit URLs to IndexNow.
 * Designed to run as the last step of sync:daily (3x/day).
 */
export async function submitRecentToIndexNow(lookbackHours = 12): Promise<{ submitted: number }> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log("[IndexNow] INDEXNOW_KEY not set, skipping");
    return { submitted: 0 };
  }

  const since = new Date(Date.now() - lookbackHours * 3600_000);
  const urls: string[] = [];

  const [scrutins, affairs, dossiers, politicians] = await Promise.all([
    db.scrutin.findMany({
      where: { updatedAt: { gte: since } },
      select: { slug: true },
    }),
    db.affair.findMany({
      where: { updatedAt: { gte: since }, publicationStatus: "PUBLISHED" },
      select: { slug: true },
    }),
    db.legislativeDossier.findMany({
      where: { updatedAt: { gte: since } },
      select: { slug: true },
    }),
    db.politician.findMany({
      where: { updatedAt: { gte: since }, publicationStatus: "PUBLISHED" },
      select: { slug: true },
    }),
  ]);

  urls.push(...scrutins.map((s) => `${SITE_URL}/votes/${s.slug}`));
  urls.push(...affairs.map((a) => `${SITE_URL}/affaires/${a.slug}`));
  urls.push(...dossiers.map((d) => `${SITE_URL}/assemblee/${d.slug}`));
  urls.push(...politicians.map((p) => `${SITE_URL}/politiques/${p.slug}`));

  if (urls.length > 0) {
    console.log(
      `[IndexNow] Submitting ${urls.length} URLs (${scrutins.length} votes, ${affairs.length} affaires, ${dossiers.length} dossiers, ${politicians.length} politiciens)`
    );
    await submitToIndexNow(urls);
  } else {
    console.log("[IndexNow] No recent changes to submit");
  }

  return { submitted: urls.length };
}
