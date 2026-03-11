import { z } from "zod/v4";

const VALID_RATINGS = [
  "TRUE",
  "MOSTLY_TRUE",
  "HALF_TRUE",
  "MISLEADING",
  "OUT_OF_CONTEXT",
  "MOSTLY_FALSE",
  "FALSE",
  "UNVERIFIABLE",
] as const;

const VALID_STATUSES = ["PUBLISHED", "DRAFT", "ARCHIVED", "EXCLUDED", "REJECTED"] as const;

export const updateFactcheckSchema = z.object({
  publicationStatus: z.enum(VALID_STATUSES).optional(),
  verdictRating: z.enum(VALID_RATINGS).optional(),
});

export const addFactcheckMentionSchema = z.object({
  politicianId: z.string().min(1),
  isClaimant: z.boolean().default(false),
});

export const updateMentionSchema = z.object({
  isClaimant: z.boolean(),
});
