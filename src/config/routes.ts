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
