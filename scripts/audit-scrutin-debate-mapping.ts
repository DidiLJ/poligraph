/**
 * READ-ONLY audit: deterministic quality of the scrutin ↔ débat mapping.
 *
 * Scope = key votes (ScrutinImportance.isKeyVote) linked to an amendment, the
 * only perimeter where the amendment-number matcher can prove a linkage. Each
 * scrutin is classified matched / ambiguous / unsafe / missing (see
 * src/services/scrutin-substance/debate-mapping.ts). No model call, NO DB write,
 * no backfill. Safe to run locally.
 *
 *   npx dotenv -e .env -- npx tsx scripts/audit-scrutin-debate-mapping.ts
 *   npx dotenv -e .env -- npx tsx scripts/audit-scrutin-debate-mapping.ts --limit 80
 *   npx dotenv -e .env -- npx tsx scripts/audit-scrutin-debate-mapping.ts --examples 8
 */
import { db } from "@/lib/db";
import {
  auditKeyScrutinDebateMapping,
  mapScrutinDebate,
  type KeyScrutinMappingRow,
} from "@/services/scrutin-substance/debate-context-resolver";
import type { DebateMatchClass } from "@/services/scrutin-substance/debate-mapping";

// Sentinel from the brief: must stay WITHOUT exploitable debate unless an exact
// debate is proven. Expected verdict: "unsafe".
const SENTINEL_EXTERNAL_ID = "VTANR5L17V7183";

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const v = process.argv[i]!;
  return v.includes("=") ? v.split("=").slice(1).join("=") : process.argv[i + 1];
}

function log(line = ""): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function printExample(r: KeyScrutinMappingRow): void {
  log(
    `  • ${r.externalId}  amdt ${r.amendmentNumber}  ${r.votingDate}  ` +
      `[${r.confidence}, ${r.candidateTranscriptCount} CR/jour${r.reinforced ? ", renforcé" : ""}]`
  );
  log(`    ${r.classReason}`);
  if (r.excerpt)
    log(`    extrait: « ${r.excerpt.slice(0, 180)}${r.excerpt.length > 180 ? "…" : ""} »`);
  if (r.slug) log(`    ${r.slug}`);
}

function printClass(
  label: string,
  klass: DebateMatchClass,
  rows: KeyScrutinMappingRow[],
  n: number
): void {
  const subset = rows.filter((r) => r.matchClass === klass).slice(0, n);
  log(
    `\n── ${label} (${rows.filter((r) => r.matchClass === klass).length}, ${subset.length} exemples) ──`
  );
  if (subset.length === 0) log("  (aucun)");
  for (const r of subset) printExample(r);
}

async function main(): Promise<void> {
  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  const examples = arg("examples") ? Number(arg("examples")) : 5;

  log(`=== Audit rattachement scrutin ↔ débat (read-only)${limit ? ` (limit ${limit})` : ""} ===`);
  log("Portée : key votes liés à un amendement. Aucun appel modèle, aucune écriture.\n");

  const report = await auditKeyScrutinDebateMapping(limit ? { limit } : {});
  const t = report.totals;

  log("PÉRIMÈTRE");
  log(`  key votes avec amendement      : ${report.scope.keyVotesWithAmendment}`);
  log(
    `  key votes SANS amendement      : ${report.scope.keyVotesWithoutAmendment}  (hors portée du matcher amendement)`
  );
  log(`  scrutins audités               : ${t.scanned}${limit ? ` (limité à ${limit})` : ""}`);

  log("\nTRANSCRIPTS DISPONIBLES");
  log(
    `  avec transcript same-day              : ${t.withSameDayTranscript}  (${pct(t.withSameDayTranscript, t.scanned)})`
  );
  log("  ATTENTION : same-day = transcripts du même jour récupérés par date seule,");
  log("    PAS un rattachement prouvé. 100% same-day ne veut pas dire 100% fiable.");

  log("\nNIVEAU DE PREUVE (mention de l'objet voté dans le débat)");
  log(
    `  HIGH  numéro d'amendement explicitement cité : ${t.confidenceHigh}  (${pct(t.confidenceHigh, t.scanned)})`
  );
  log(
    `  MEDIUM/LOW  auteur/article seulement         : ${t.confidenceMediumLow}  (${pct(t.confidenceMediumLow, t.scanned)})`
  );
  log("    (un article seul n'est PAS une référence explicite suffisante : cf. cas 2084)");
  log(
    `  NONE  aucun signal exploitable               : ${t.confidenceNone}  (${pct(t.confidenceNone, t.scanned)})`
  );

  log("\nCLASSES (rattachement scrutin ↔ débat)");
  log(`  débat exploitable (matched)           : ${t.matched}  (${pct(t.matched, t.scanned)})`);
  log(`  cas ambigus (ambiguous)               : ${t.ambiguous}  (${pct(t.ambiguous, t.scanned)})`);
  log(`  transcript sans mention (unsafe)      : ${t.unsafe}  (${pct(t.unsafe, t.scanned)})`);
  log(`  sans transcript same-day (missing)    : ${t.missing}  (${pct(t.missing, t.scanned)})`);

  log("\nDIAGNOSTIC (recommandation)");
  log(
    `  localisables de façon unique          : ${t.uniquelyLocalizable}  (${pct(t.uniquelyLocalizable, t.scanned)})`
  );
  log("  = HIGH dont le numéro n'apparaît que dans UNE séance du jour. Classés ambiguous");
  log("    sous la règle stricte same-day, mais promouvables en matched si l'ingestion");
  log("    scopait par séance plutôt que par jour.");

  printClass("BONS / matched", "matched", report.rows, examples);
  printClass("AMBIGUS / ambiguous", "ambiguous", report.rows, examples);
  printClass("MAUVAIS / unsafe (transcript mais pas de mention)", "unsafe", report.rows, examples);
  printClass("MAUVAIS / missing (aucun transcript)", "missing", report.rows, examples);

  // Sentinel: VTANR5L17V7183 / amendement 2084 must stay unsafe.
  log(`\n── CAS SENTINELLE ${SENTINEL_EXTERNAL_ID} (amendement 2084) ──`);
  const sentinel = await db.scrutin.findUnique({
    where: { externalId: SENTINEL_EXTERNAL_ID },
    select: {
      id: true,
      externalId: true,
      slug: true,
      votingDate: true,
      analysis: { select: { id: true } },
      amendmentLinks: { select: { amendment: { select: { number: true } } }, take: 1 },
    },
  });
  if (!sentinel) {
    log("  introuvable en base.");
  } else {
    const row = await mapScrutinDebate({
      id: sentinel.id,
      externalId: sentinel.externalId,
      slug: sentinel.slug,
      votingDate: sentinel.votingDate,
      amendmentNumber: sentinel.amendmentLinks[0]?.amendment.number ?? "?",
    });
    log(`  analyse existante : ${sentinel.analysis ? "OUI" : "non"}`);
    log(`  classe            : ${row.matchClass}  (attendu: unsafe)`);
    printExample(row);
    if (row.matchClass === "unsafe") {
      log("  ✓ Conforme : reste sans débat exploitable, aucune analyse ne doit être générée.");
    } else {
      log(
        `  ✗ ANOMALIE : classe ${row.matchClass} au lieu de unsafe, à investiguer avant tout branchement.`
      );
    }
  }
  log("");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
