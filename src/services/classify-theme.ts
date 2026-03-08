/**
 * Theme classification for legislative dossiers and scrutins.
 *
 * Uses Claude Haiku to categorize legislative texts into one of 13
 * controlled theme values. This is taxonomic classification over
 * existing text, not content generation.
 */

import { callAnthropic, extractToolUse } from "@/lib/api/anthropic";

const MODEL = "claude-haiku-4-5-20251001";

const THEME_VALUES = [
  "ECONOMIE_BUDGET",
  "SOCIAL_TRAVAIL",
  "SECURITE_JUSTICE",
  "ENVIRONNEMENT_ENERGIE",
  "SANTE",
  "EDUCATION_CULTURE",
  "INSTITUTIONS",
  "AFFAIRES_ETRANGERES_DEFENSE",
  "NUMERIQUE_TECH",
  "IMMIGRATION",
  "AGRICULTURE_ALIMENTATION",
  "LOGEMENT_URBANISME",
  "TRANSPORTS",
] as const;

export type ThemeCategoryValue = (typeof THEME_VALUES)[number];

/**
 * Classify a legislative text or scrutin into a theme category using AI
 */
export async function classifyTheme(
  title: string,
  summary?: string | null,
  context?: string | null
): Promise<ThemeCategoryValue | null> {
  let input = `Titre : ${title}`;
  if (summary) input += `\nRésumé : ${summary}`;
  if (context) input += `\nContexte : ${context}`;

  const prompt = `Tu es un classificateur thématique pour des textes législatifs français. Classe le texte suivant dans une catégorie en utilisant l'outil classify_theme.

${input}

Guide des catégories :
- ECONOMIE_BUDGET : fiscalité, budget de l'État, finances publiques, commerce, entreprises
- SOCIAL_TRAVAIL : emploi, droit du travail, retraites, protection sociale, handicap
- SECURITE_JUSTICE : police, justice, pénal, prisons, terrorisme, ordre public
- ENVIRONNEMENT_ENERGIE : écologie, climat, énergie, biodiversité, pollution
- SANTE : santé publique, hôpitaux, médicaments, bioéthique, pandémies
- EDUCATION_CULTURE : éducation, université, recherche, culture, sport, médias
- INSTITUTIONS : Constitution, élections, collectivités, réforme de l'État, outre-mer
- AFFAIRES_ETRANGERES_DEFENSE : diplomatie, défense, armée, coopération internationale, UE
- NUMERIQUE_TECH : numérique, données, IA, télécommunications, cybersécurité
- IMMIGRATION : immigration, asile, nationalité, intégration, frontières
- AGRICULTURE_ALIMENTATION : agriculture, pêche, alimentation, ruralité
- LOGEMENT_URBANISME : logement, urbanisme, construction, copropriété
- TRANSPORTS : transports, mobilité, routes, ferroviaire, aérien, maritime`;

  const tools = [
    {
      name: "classify_theme",
      description: "Classifie un texte législatif dans une catégorie thématique.",
      input_schema: {
        type: "object" as const,
        properties: {
          theme: {
            type: "string",
            enum: [...THEME_VALUES],
            description: "La catégorie thématique du texte législatif",
          },
        },
        required: ["theme"],
      },
    },
  ];

  const data = await callAnthropic([{ role: "user", content: prompt }], {
    model: MODEL,
    maxTokens: 100,
    tools,
    toolChoice: { type: "tool", name: "classify_theme" },
  });

  const toolInput = extractToolUse(data) as { theme?: string } | null;
  if (!toolInput?.theme) {
    throw new Error("No tool_use content in API response");
  }

  let theme = toolInput.theme;

  // Fallback: AI may still rarely return inverted names despite enum constraint
  const THEME_ALIASES: Record<string, ThemeCategoryValue> = {
    CULTURE_EDUCATION: "EDUCATION_CULTURE",
    JUSTICE_SECURITE: "SECURITE_JUSTICE",
    CULTURE_PATRIMOINE: "EDUCATION_CULTURE",
    BUDGET_ECONOMIE: "ECONOMIE_BUDGET",
    TRAVAIL_SOCIAL: "SOCIAL_TRAVAIL",
    ENERGIE_ENVIRONNEMENT: "ENVIRONNEMENT_ENERGIE",
    DEFENSE_AFFAIRES_ETRANGERES: "AFFAIRES_ETRANGERES_DEFENSE",
    TECH_NUMERIQUE: "NUMERIQUE_TECH",
    ALIMENTATION_AGRICULTURE: "AGRICULTURE_ALIMENTATION",
    URBANISME_LOGEMENT: "LOGEMENT_URBANISME",
  };

  if (theme && THEME_ALIASES[theme]) {
    theme = THEME_ALIASES[theme]!;
  }

  if (THEME_VALUES.includes(theme as ThemeCategoryValue)) {
    return theme as ThemeCategoryValue;
  }

  console.warn(`Invalid theme value: ${theme}`);
  return null;
}
