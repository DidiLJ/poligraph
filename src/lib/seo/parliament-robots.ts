import type { Metadata } from "next";

const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/**
 * A vote date-archive slug, e.g. "2026-03-04". Shared source of truth: the
 * /parlement/votes/[slug] route uses it both to render the daily archive and to
 * decide its robots directive, so the two never drift.
 */
export const VOTE_DATE_ARCHIVE_SLUG = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when a /parlement/votes/[slug] URL is a day archive rather than a scrutin.
 * A real scrutin can never own a bare-date slug: the route resolves YYYY-MM-DD as
 * an archive before any scrutin lookup, so this never matches a vote detail page.
 */
export function isVoteDateArchiveSlug(slug: string): boolean {
  return VOTE_DATE_ARCHIVE_SLUG.test(slug);
}

/**
 * `robots` metadata fragment for /parlement/votes/[slug].
 *
 * Date-archive pages (/parlement/votes/2026-03-04) are day-filtered lists of links
 * to individual scrutins: no unique editorial content, absent from the sitemap, and
 * DateNavigation exposes prev/next <a> links that let crawlers walk every historical
 * day. That is a large "crawled, currently not indexed" surface. noindex,follow drops
 * the archives from the index while keeping the individual vote pages reachable.
 *
 * Returns {} for scrutin slugs so they inherit the site default (index:true). Spread
 * into the page's generateMetadata return.
 */
export function voteDateArchiveRobotsMetadata(slug: string): Pick<Metadata, "robots"> {
  return isVoteDateArchiveSlug(slug) ? { robots: NOINDEX_FOLLOW } : {};
}
