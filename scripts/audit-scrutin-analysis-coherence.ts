/**
 * Read-only audit of "Les enjeux du vote" (ScrutinAnalysis) for amendment-linked
 * scrutins. Flags rows at risk of describing a different measure than the voted
 * amendment: STRUCTURED_DATA (no real debate), missing debate transcript, or low
 * lexical coverage with the official substance. NO model call, NO write.
 *
 *   npx dotenv -e .env -- npx tsx scripts/audit-scrutin-analysis-coherence.ts
 *   npx dotenv -e .env -- npx tsx scripts/audit-scrutin-analysis-coherence.ts --limit 50
 */
import { db } from "@/lib/db";
import { auditScrutinAnalysisCoherence } from "@/services/sync/scrutin-analysis";

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const v = process.argv[i]!;
  if (v.includes("=")) return v.split("=").slice(1).join("=");
  return process.argv[i + 1];
}
function log(line = ""): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

async function main(): Promise<void> {
  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  log(
    `=== ScrutinAnalysis coherence audit (amendment-linked)${limit ? ` — limit ${limit}` : ""} ===\n`
  );

  const report = await auditScrutinAnalysisCoherence(limit ? { limit } : {});

  log(`scanned : ${report.scanned}`);
  log(`at risk : ${report.atRisk.length}\n`);

  const noDebate = report.atRisk.filter((r) => !r.hasDebate).length;
  const structured = report.atRisk.filter((r) => r.sourceType === "STRUCTURED_DATA").length;
  log(`  ...sans débat propre   : ${noDebate}`);
  log(`  ...sourceType STRUCTURED_DATA : ${structured}\n`);

  for (const r of [...report.atRisk].sort((a, b) => a.coverage - b.coverage)) {
    log(
      `─ coverage ${r.coverage.toFixed(2)} [ref=${r.referenceUsed}] debat=${r.hasDebate} src=${r.sourceType}`
    );
    log(`  ${r.slug ?? r.scrutinId}`);
    log(`  titre   : ${r.policyTitle ?? r.title.slice(0, 90)}`);
    log(`  argFor  : ${r.argumentsForExcerpt}`);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
