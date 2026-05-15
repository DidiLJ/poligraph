import { describe, it, expect } from "vitest";
import { RSSClient, type RSSFeedConfig } from "./rss";

/**
 * Parse contract tests for Q3 2026 candidate RSS feeds.
 *
 * Verifies each candidate feed can be fetched and parsed into items
 * carrying a title, an http(s) link, and a publication date.
 *
 * Network-bound: set SKIP_NETWORK_TESTS=1 to bypass in offline CI.
 * Task 12 only validates the contract; Task 13 will wire approved feeds
 * into RSS_FEEDS.
 */

interface CandidateFeed extends RSSFeedConfig {
  skipReason?: string;
}

const CANDIDATE_FEEDS: CandidateFeed[] = [
  {
    id: "reporterre",
    name: "Reporterre",
    url: "https://reporterre.net/spip.php?page=backend",
    priority: 2,
  },
  {
    id: "mediacites",
    name: "Mediacités",
    url: "https://www.mediacites.fr/feed/",
    priority: 2,
  },
  {
    id: "afpnews-politique",
    name: "AFP politique",
    url: "https://www.afp.com/fr/news-hub/4106/rss",
    priority: 2,
    skipReason: "HTTP 404 on /fr/news-hub/4106/rss; no public politics-only RSS confirmed",
  },
  {
    id: "bfmtv-politique",
    name: "BFM politique",
    url: "https://www.bfmtv.com/rss/politique/",
    priority: 2,
  },
  {
    id: "lacroix-politique",
    name: "La Croix politique",
    url: "https://www.la-croix.com/rss/Politique",
    priority: 2,
    skipReason: "HTTP 404 on /rss/Politique; la-croix.com only exposes universe-level feeds",
  },
];

const skipNetwork = process.env.SKIP_NETWORK_TESTS === "1";

describe.skipIf(skipNetwork)("RSS feed parse contract - Q3 2026 candidates", () => {
  const client = new RSSClient({ timeout: 25_000, retries: 1 });

  for (const feed of CANDIDATE_FEEDS) {
    const runner = feed.skipReason ? it.skip : it;
    const title = feed.skipReason
      ? `parses ${feed.id} into items with title, url, publishedAt (skipped: ${feed.skipReason})`
      : `parses ${feed.id} into items with title, url, publishedAt`;

    runner(
      title,
      async () => {
        const result = await client.fetchFeed(feed);

        expect(result.items.length).toBeGreaterThan(0);

        const first = result.items[0];
        expect(typeof first.title).toBe("string");
        expect(first.title.length).toBeGreaterThan(0);
        expect(first.link).toMatch(/^https?:\/\//);
        expect(first.pubDate).toBeInstanceOf(Date);
        expect(Number.isNaN(first.pubDate.getTime())).toBe(false);
      },
      30_000
    );
  }
});
