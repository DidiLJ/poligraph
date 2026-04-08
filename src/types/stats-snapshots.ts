import { z } from "zod";

/**
 * Type-safe schemas for known StatsSnapshot.key values.
 * Each entry maps a key to its Zod parser. Use `parseSnapshot()` at read time
 * to validate the JSON shape and get a typed result.
 */

// ─── municipales-2026-parite-outliers ─────────────────────
export const ParityListRowSchema = z.object({
  listName: z.string(),
  communeId: z.string(),
  communeName: z.string(),
  departmentCode: z.string(),
  femaleRate: z.number(),
  candidateCount: z.number().int(),
});
export type ParityListRow = z.infer<typeof ParityListRowSchema>;

export const ParityOutliersSchema = z.object({
  best: z.array(ParityListRowSchema),
  worst: z.array(ParityListRowSchema),
});
export type ParityOutliers = z.infer<typeof ParityOutliersSchema>;

// ─── municipales-2026-parite-by-bracket ───────────────────
export const ParityBracketRowSchema = z.object({
  bracket: z.string(),
  femaleRate: z.number(),
  femaleCount: z.number().int(),
  maleCount: z.number().int(),
  totalCount: z.number().int(),
});
export type ParityBracketRow = z.infer<typeof ParityBracketRowSchema>;
export const ParityBySizeSchema = z.array(ParityBracketRowSchema);
export type ParityBySize = z.infer<typeof ParityBySizeSchema>;

// ─── municipales-2026-dept-party-counts ───────────────────
export const DeptPartyRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  parties: z.array(z.object({ label: z.string(), listCount: z.number().int() })),
  totalLists: z.number().int(),
  dominantParty: z.string().nullable(),
});
export type DeptPartyRow = z.infer<typeof DeptPartyRowSchema>;
export const DeptPartyDataSchema = z.array(DeptPartyRowSchema);
export type DeptPartyData = z.infer<typeof DeptPartyDataSchema>;

// ─── Key registry ─────────────────────────────────────────
export const MUNICIPALES_SNAPSHOT_KEYS = {
  parityOutliers: "municipales-2026-parite-outliers",
  parityBySize: "municipales-2026-parite-by-bracket",
  deptParty: "municipales-2026-dept-party-counts",
} as const;

export type MunicipalesSnapshotKey =
  (typeof MUNICIPALES_SNAPSHOT_KEYS)[keyof typeof MUNICIPALES_SNAPSHOT_KEYS];

/**
 * Parse a `StatsSnapshot.data` JSON value with the right schema.
 * Throws if the shape is wrong (which should never happen, but if it does
 * we want a loud error rather than silent corruption).
 */
export function parseSnapshot<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
