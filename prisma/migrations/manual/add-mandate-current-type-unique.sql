-- Partial unique index: at most ONE active PARLIAMENTARY mandate of a given type
-- per politician. Prevents import duplicates (e.g. a Wikidata stub created
-- alongside the official SENAT/ASSEMBLEE_NATIONALE mandate) that inflate the
-- vote-by-theme aggregates in compute-stats.ts.
--
-- Scope of the constraint:
--   - active mandates only (WHERE "isCurrent" = true);
--   - DEPUTE / SENATEUR only. NOT all types on purpose: a politician legitimately
--     has only one active seat per chamber, but other same-type situations are
--     either legitimate or a different data-quality concern (e.g. homonym MAIRE
--     of two communes, stale PRESIDENT_PARTI flags) that must not be force-failed
--     here. Different types always coexist (legitimate cumul, e.g. DEPUTE + MAIRE);
--   - historical mandates (isCurrent = false) are unconstrained.
--
-- Not expressible in schema.prisma without the `partialIndexes` preview feature,
-- so it lives here (same pattern as the trigram / FTS indexes). Prisma db push
-- leaves it alone (verified: it is not reported as drift by `prisma migrate diff`).
--
-- PREREQUISITE: deduplicate existing rows first (delete the duplicate stubs),
-- otherwise creation fails with a unique-violation.
CREATE UNIQUE INDEX IF NOT EXISTS "Mandate_current_type_uq"
  ON "Mandate" ("politicianId", "type")
  WHERE "isCurrent" = true
    AND "type" IN ('DEPUTE'::"MandateType", 'SENATEUR'::"MandateType");
