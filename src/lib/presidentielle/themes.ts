import type { ThemeCategory } from "@/generated/prisma";
import { THEME_CATEGORY_LABELS } from "@/config/labels";
import { themeToSlug } from "@/lib/theme-utils";

export { themeToSlug, themeFromSlug as parseThemeSlug } from "@/lib/theme-utils";

export const PRESIDENTIELLE_2027_SLUG = "presidentielle-2027";

/** Ordre éditorial d'affichage des 13 thèmes. */
export const THEMES_IN_ORDER: ThemeCategory[] = [
  "LOGEMENT_URBANISME",
  "SANTE",
  "SOCIAL_TRAVAIL",
  "ECONOMIE_BUDGET",
  "ENVIRONNEMENT_ENERGIE",
  "SECURITE_JUSTICE",
  "EDUCATION_CULTURE",
  "IMMIGRATION",
  "TRANSPORTS",
  "AGRICULTURE_ALIMENTATION",
  "NUMERIQUE_TECH",
  "AFFAIRES_ETRANGERES_DEFENSE",
  "INSTITUTIONS",
];

function normalizeThemeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Search the controlled subject taxonomy without duplicating it in the full-text index. */
export function findMatchingThemes(query: string): ThemeCategory[] {
  const normalized = normalizeThemeSearch(query);
  if (normalized.length < 2) return [];

  const queryTerms = normalized.split(" ");
  return THEMES_IN_ORDER.filter((theme) => {
    const searchable = normalizeThemeSearch(
      `${THEME_CATEGORY_LABELS[theme]} ${themeToSlug(theme)}`
    );
    const subjectTerms = searchable.split(" ");
    return queryTerms.every((queryTerm) =>
      subjectTerms.some(
        (subjectTerm) =>
          subjectTerm === queryTerm || (queryTerm.length >= 3 && subjectTerm.startsWith(queryTerm))
      )
    );
  });
}
