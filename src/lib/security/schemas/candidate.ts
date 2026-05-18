import { z } from "zod/v4";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export const createCandidatePresidentialSchema = z.object({
  candidacyId: z.string().min(1),
  slogan: z.string().max(200).optional(),
  accentColor: z.string().regex(HEX_COLOR_RE).optional(),
  declaredAt: z.string().datetime().optional(),
  withdrewAt: z.string().datetime().optional(),
  withdrewReason: z.string().max(1000).optional(),
  rank: z.number().int().min(0).max(999).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCandidatePresidentialSchema = z.object({
  slogan: z.string().max(200).nullable().optional(),
  accentColor: z.string().regex(HEX_COLOR_RE).nullable().optional(),
  declaredAt: z.string().datetime().nullable().optional(),
  withdrewAt: z.string().datetime().nullable().optional(),
  withdrewReason: z.string().max(1000).nullable().optional(),
  rank: z.number().int().min(0).max(999).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "EXCLUDED", "REJECTED"]).optional(),
});

export const createCandidacyFromPickerSchema = z.object({
  politicianId: z.string().min(1),
  electionSlug: z.string().min(1),
  status: z.enum(["DECLARE", "PRESSENTI", "ENVISAGE", "RETIRE"]).default("PRESSENTI"),
  slogan: z.string().max(200).optional(),
  rank: z.number().int().min(0).max(999).optional(),
});
