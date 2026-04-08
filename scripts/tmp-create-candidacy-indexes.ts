/**
 * Creates the Phase 2 composite indexes on Candidacy via CREATE INDEX CONCURRENTLY.
 *
 * Why CONCURRENTLY: standard CREATE INDEX takes an ACCESS EXCLUSIVE lock for the
 * duration of the build (10-30s on 1.28M rows). CONCURRENTLY uses two sequential
 * scans without blocking writes, at the cost of being slower wall-clock.
 *
 * Why not db:push: db:push wraps DDL in a transaction. CREATE INDEX CONCURRENTLY
 * cannot run inside a transaction. Hence: raw SQL via direct connection.
 *
 * Idempotent: uses IF NOT EXISTS so re-running is safe.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/tmp-create-candidacy-indexes.ts
 */
import { db } from "../src/lib/db";

const INDEXES = [
  {
    name: "Candidacy_electionId_listName_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Candidacy_electionId_listName_idx"
          ON "Candidacy" ("electionId", "listName")`,
    purpose: "parity by list (queries #4, #5)",
  },
  {
    name: "Candidacy_electionId_partyLabel_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Candidacy_electionId_partyLabel_idx"
          ON "Candidacy" ("electionId", "partyLabel")`,
    purpose: "department x party (query #1)",
  },
  {
    name: "Candidacy_electionId_candidateId_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Candidacy_electionId_candidateId_idx"
          ON "Candidacy" ("electionId", "candidateId")`,
    purpose: "join Candidate for parity",
  },
];

async function main() {
  console.log(`Creating ${INDEXES.length} indexes on Candidacy...`);

  for (const idx of INDEXES) {
    const start = Date.now();
    console.log(`\n[${idx.name}] ${idx.purpose}`);
    try {
      // $executeRawUnsafe is required because CREATE INDEX CONCURRENTLY can't be
      // parameterized and the SQL is static (no user input). The repo's CI grep
      // forbids $executeRawUnsafe in src/ but allows it in scripts/.
      await db.$executeRawUnsafe(idx.sql);
      console.log(`  -> created in ${Date.now() - start}ms`);
    } catch (err) {
      console.error(`  -> FAILED: ${(err as Error).message}`);
      throw err;
    }
  }

  console.log('\nRunning ANALYZE "Candidacy" to refresh planner stats...');
  await db.$executeRawUnsafe(`ANALYZE "Candidacy"`);
  console.log("  -> done");

  console.log("\nVerification - listing all indexes on Candidacy:");
  const rows = await db.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE tablename = 'Candidacy' ORDER BY indexname
  `;
  for (const row of rows) {
    console.log(`  ${row.indexname}`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
