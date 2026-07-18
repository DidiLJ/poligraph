/**
 * Next.js turns every route's `opengraph-image` file into a real URL and injects it as
 * an `<meta property="og:image">` tag. Search engines then crawl those image URLs like
 * ordinary pages, which floods Search Console Coverage with "crawled, currently not
 * indexed" entries. The bulk sits under /parlement/votes and /parlement/dossiers, where
 * every scrutin and dossier ships its own generated image.
 *
 * Tagging the image responses with `X-Robots-Tag: noindex` tells indexers to drop the
 * image URLs. Social crawlers (Facebook, X, LinkedIn, Slack, Discord, WhatsApp) still
 * download the bytes for link previews: noindex is an indexing directive, not an access
 * restriction, so previews are unaffected.
 *
 * `OG_IMAGE_ROBOTS_SOURCE` matches any path ending in `/opengraph-image` (root, static
 * and dynamic segments alike) and nothing else. Verified against Next's own route matcher
 * in `src/lib/seo/__tests__/og-image-robots.test.ts`.
 */

// Structural subset of Next's custom-route Header type (source + headers are the only
// required fields; has/missing/locale/basePath stay optional and unused here).
type NextHeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

export const OG_IMAGE_ROBOTS_SOURCE = "/:path*/opengraph-image";

export const OG_IMAGE_NOINDEX_HEADERS: NextHeaderRule[] = [
  {
    source: OG_IMAGE_ROBOTS_SOURCE,
    headers: [{ key: "X-Robots-Tag", value: "noindex" }],
  },
];
