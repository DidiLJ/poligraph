-- Trigram GIN indexes for enhanced scrutin search
-- Run: psql $DATABASE_URL < prisma/migrations/manual/add_scrutin_search_indexes.sql
--
-- These indexes accelerate ILIKE queries on AI-generated text fields
-- used by the /parlement hub search (OR across title, summary, citizenImpact, dossier title).
-- The Scrutin.title index already exists (see add_trigram_indexes.sql).

-- Scrutin.summary — AI-generated plain-language summary
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Scrutin_summary_trgm"
ON "Scrutin" USING gin ("summary" gin_trgm_ops);

-- Scrutin.citizenImpact — AI-generated citizen impact explanation
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Scrutin_citizenImpact_trgm"
ON "Scrutin" USING gin ("citizenImpact" gin_trgm_ops);

-- LegislativeDossier.title — for JOIN-based search through dossierLegislatif relation
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LegislativeDossier_title_trgm"
ON "LegislativeDossier" USING gin ("title" gin_trgm_ops);
