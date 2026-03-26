import { z } from "zod/v4";

const THEMATIC_AXES = [
  "ECONOMIC_ROLE",
  "SOCIETAL_NORMS",
  "ECOLOGICAL_TRANSITION",
  "SECURITY_LIBERTIES",
  "DEMOCRACY_INSTITUTIONS",
  "EUROPEAN_INTEGRATION",
  "IMMIGRATION",
  "FOREIGN_AFFAIRS",
  "URBAN_PLANNING",
  "PUBLIC_SERVICES",
  "MOBILITY",
] as const;

const QUIZ_SCOPES = ["COMMON", "NATIONAL", "MUNICIPAL"] as const;

const PUBLICATION_STATUSES = ["PUBLISHED", "DRAFT", "ARCHIVED", "EXCLUDED", "REJECTED"] as const;

// Platform

export const createPlatformSchema = z.object({
  partyId: z.string().min(1).nullable(),
  electoralListId: z.string().min(1).nullable(),
  electionId: z.string().min(1),
  sourceUrl: z.url().nullable().optional(),
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
});

export const updatePlatformSchema = createPlatformSchema.partial().extend({
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
});

// Proposal

export const createProposalSchema = z.object({
  platformId: z.string().min(1),
  axis: z.enum(THEMATIC_AXES),
  position: z.int().min(-1).max(1),
  summary: z.string().min(1).max(500),
  sourceExcerpt: z.string().max(5000).nullable().optional(),
  sourceUrl: z.url().nullable().optional(),
  aiGenerated: z.boolean().optional(),
  verifiedBy: z.string().nullable().optional(),
});

export const updateProposalSchema = createProposalSchema
  .omit({ platformId: true, axis: true })
  .partial();

// QuizQuestion

export const createQuizQuestionSchema = z.object({
  axis: z.enum(THEMATIC_AXES),
  scope: z.enum(QUIZ_SCOPES),
  statement: z.string().min(10).max(500),
  order: z.int().min(0),
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
});

export const updateQuizQuestionSchema = createQuizQuestionSchema.partial();
