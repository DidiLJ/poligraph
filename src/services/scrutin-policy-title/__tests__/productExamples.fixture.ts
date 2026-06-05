// Source of truth for good/bad policy titles. Adding a case = adding a row here.
export const BAD_TITLES: { title: string; expectBlocker: string }[] = [
  { title: "Rétablir l'article 8 du projet de loi agricole", expectBlocker: "ARTICLE_ONLY" },
  { title: "Modifier l'article 8", expectBlocker: "ARTICLE_ONLY" },
  { title: "Vote sur le sous-amendement 2368", expectBlocker: "AMENDMENT_NUMBER_ONLY" },
  { title: "Adopter l'amendement du Gouvernement", expectBlocker: "RESULT_LEAKAGE" },
  { title: "Rejeter la motion de rejet", expectBlocker: "RESULT_LEAKAGE" },
  { title: "Les députés rejettent la limitation des dérogations", expectBlocker: "RESULT_LEAKAGE" },
  { title: "La mesure est adoptée pour limiter les dérogations", expectBlocker: "RESULT_LEAKAGE" },
  { title: "L'Assemblée refuse de réviser les seuils", expectBlocker: "RESULT_LEAKAGE" },
];
export const GOOD_TITLES: string[] = [
  "Limiter les dérogations aux seuils de qualité de l'eau",
  "Supprimer une exonération aux règles de qualité de l'eau",
  "Obliger les contrats écrits entre agriculteurs et acheteurs",
  "Renforcer les contrôles sur les importations agricoles",
];
