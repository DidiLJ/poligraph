import { z } from "zod/v4";

const THEME_CATEGORY_VALUES = [
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

const PROMISE_SOURCE_KIND_VALUES = [
  "DISCOURS_AN",
  "DISCOURS_SENAT",
  "INTERVIEW_PRESSE",
  "ARTICLE_PRESSE",
  "PROPOSITION_LOI",
  "PROGRAMME_PARTI",
  "DECLARATION_PUBLIQUE",
  "AUTRE",
] as const;

const PROMISE_EXTRACTION_STATUS_VALUES = [
  "EXTRACTED",
  "PUBLISHED",
  "REJECTED",
  "NEEDS_REVIEW",
] as const;

export const createPromiseSchema = z.object({
  politicianId: z.string().min(1),
  text: z.string().min(10).max(500),
  context: z.string().max(1000).optional(),
  theme: z.enum(THEME_CATEGORY_VALUES),
  sourceKind: z.enum(PROMISE_SOURCE_KIND_VALUES),
  sourceUrl: z.string().url().optional(),
  sourceLabel: z.string().max(100).optional(),
  publishedAt: z.string().datetime(),
});

export const updatePromiseSchema = z.object({
  theme: z.enum(THEME_CATEGORY_VALUES).optional(),
  extractionStatus: z.enum(PROMISE_EXTRACTION_STATUS_VALUES).optional(),
  rejectionReason: z.string().max(500).optional(),
});
