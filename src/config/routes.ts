import type { Chamber } from "@/generated/prisma";

export const ROUTES = {
  parlement: "/parlement",
  votes: "/parlement/votes",
  voteDetail: (slug: string) => `/parlement/votes/${slug}`,
  votesToday: "/parlement/votes/aujourd-hui",
  voteStats: "/parlement/votes/stats",
  voteThemes: "/parlement/votes/themes",
  voteTheme: (slug: string) => `/parlement/votes/themes/${slug}`,
  dossiers: "/parlement/dossiers",
  dossierDetail: (slug: string) => `/parlement/dossiers/${slug}`,
  groupes: "/parlement/groupes",
  groupeDetail: (slug: string) => `/parlement/groupes/${slug}`,
} as const;

/**
 * Tabs rendered by /statistiques. Single source of truth: `StatsTabs` reads this
 * list to validate `?tab=`, and `statsHref` only accepts a value from it, so
 * linking to a tab that no longer exists is a type error rather than a silent
 * fallback to the default tab.
 */
export const STATS_TABS = ["judiciaire", "factchecks", "legislatif", "participation"] as const;
export type StatsTab = (typeof STATS_TABS)[number];
export const DEFAULT_STATS_TAB: StatsTab = "judiciaire";

/**
 * Build a /statistiques URL. `chamber` is only read by the participation tab.
 * The default tab is left out so the canonical URL stays /statistiques.
 */
export function statsHref(tab: StatsTab, params?: { chamber?: Chamber }): string {
  const search = new URLSearchParams();
  if (tab !== DEFAULT_STATS_TAB) search.set("tab", tab);
  if (params?.chamber) search.set("chamber", params.chamber);
  const qs = search.toString();
  return qs ? `/statistiques?${qs}` : "/statistiques";
}
