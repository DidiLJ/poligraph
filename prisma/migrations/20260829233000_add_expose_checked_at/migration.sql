-- Rotation cursor for sync:legislation:content, mirroring Politician.photoCheckedAt.
--
-- Before this column, the sync queried WHERE exposeDesMotifs IS NULL ordered by
-- filingDate desc with no other cursor: a dossier the AN will never publish (a
-- Senate-originated text, requested against the AN endpoint) stayed at the same
-- priority forever and permanently starved dossiers filed earlier. Stamping every
-- attempt here, successful or not, lets the sync order by "checked longest ago /
-- never checked" and rotate through the whole backlog instead of retrying the
-- same unreachable documents on every run.
ALTER TABLE "LegislativeDossier" ADD COLUMN "exposeCheckedAt" TIMESTAMP(3);

CREATE INDEX "LegislativeDossier_exposeCheckedAt_idx" ON "LegislativeDossier"("exposeCheckedAt");
