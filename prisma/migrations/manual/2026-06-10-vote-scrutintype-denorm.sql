-- Issue #377: keep Vote.scrutinType in sync with Scrutin.type, mirroring the
-- votingDate/chamber denormalization from 2026-04-08-vote-denorm-trigger.sql.
-- Application code populates scrutinType on INSERT (writeVotesForScrutin); this
-- trigger handles the rare UPDATE case (an editor correcting a scrutin's type).

CREATE OR REPLACE FUNCTION sync_vote_denorm_from_scrutin()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when one of the denormalized columns actually changed
  IF OLD."votingDate" IS DISTINCT FROM NEW."votingDate"
     OR OLD."chamber" IS DISTINCT FROM NEW."chamber"
     OR OLD."type" IS DISTINCT FROM NEW."type" THEN
    UPDATE "Vote"
    SET "votingDate"  = NEW."votingDate",
        "chamber"     = NEW."chamber",
        "scrutinType" = NEW."type"
    WHERE "scrutinId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_vote_denorm_from_scrutin_trigger ON "Scrutin";

CREATE TRIGGER sync_vote_denorm_from_scrutin_trigger
AFTER UPDATE OF "votingDate", "chamber", "type" ON "Scrutin"
FOR EACH ROW
EXECUTE FUNCTION sync_vote_denorm_from_scrutin();
