/**
 * Debug entry for the citizen-impact generator. Two modes:
 *
 * 1. Single scrutin — show the EXACT input sent to the model, optionally
 *    generate (read-only) or persist.
 *      npx dotenv -e .env -- npx tsx scripts/debug-scrutin-citizen-impact.ts --scrutin-id <id>
 *      npx dotenv -e .env -- npx tsx scripts/debug-scrutin-citizen-impact.ts --slug <slug>
 *      npx dotenv -e .env -- npx tsx scripts/debug-scrutin-citizen-impact.ts --slug <slug> --generate
 *      npx dotenv -e .env -- npx tsx scripts/debug-scrutin-citizen-impact.ts --slug <slug> --write
 *
 * 2. Coherence audit — read-only report of amendment-linked scrutins whose
 *    EXISTING citizen impact is incoherent with the official reference. No
 *    model call, no write.
 *      npx dotenv -e .env -- npx tsx scripts/debug-scrutin-citizen-impact.ts --audit --limit 200
 *
 * It NEVER writes unless `--write` is passed explicitly.
 */
import { db } from "@/lib/db";
import {
  prepareCitizenImpactInput,
  generateScrutinCitizenImpacts,
  auditCitizenImpactCoherence,
} from "@/services/sync/generate-scrutin-citizen-impacts";
import {
  buildUserMessage,
  generateCitizenImpact,
  assessCitizenImpactCoherence,
  SYSTEM_PROMPT,
} from "@/services/scrutin-citizen-impact";

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const v = process.argv[i]!;
  if (v.includes("=")) return v.split("=").slice(1).join("=");
  return process.argv[i + 1];
}
function flag(name: string): boolean {
  return process.argv.some((a) => a === `--${name}`);
}
function log(line = ""): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

async function runAudit(): Promise<void> {
  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  log(
    `=== Coherence audit (amendment-linked scrutins, existing impacts)${limit ? ` — limit ${limit}` : ""} ===\n`
  );
  const report = await auditCitizenImpactCoherence(limit ? { limit } : {});
  log(`scanned    : ${report.scanned}`);
  log(`incoherent : ${report.incoherent.length}\n`);
  const sorted = [...report.incoherent].sort((a, b) => a.coverage - b.coverage);
  for (const row of sorted) {
    log(`─ coverage ${row.coverage.toFixed(2)} [ref=${row.referenceUsed}]`);
    log(`  ${row.slug ?? row.scrutinId}`);
    log(`  title : ${row.policyTitle ?? row.title.slice(0, 90)}`);
  }
}

async function runSingle(): Promise<void> {
  const scrutinIdArg = arg("scrutin-id");
  const slug = arg("slug");
  const generate = flag("generate");
  const write = flag("write");

  let scrutinId = scrutinIdArg;
  if (!scrutinId && slug) {
    const row = await db.scrutin.findUnique({ where: { slug }, select: { id: true } });
    if (!row) throw new Error(`No scrutin for slug ${slug}`);
    scrutinId = row.id;
  }
  if (!scrutinId) throw new Error("Pass --scrutin-id <id> or --slug <slug> (or --audit).");

  const prepared = await prepareCitizenImpactInput(scrutinId);
  if (!prepared) throw new Error(`Scrutin not found: ${scrutinId}`);

  log(`─── ${prepared.slug ?? scrutinId} ───────────────────────────────`);
  log(`title             : ${prepared.title}`);
  log(`hasLinkedAmendment: ${prepared.hasLinkedAmendment}`);
  log(`substanceDepth    : ${prepared.substanceDepth ?? "null"}`);
  log(`substanceBlocks   : ${prepared.input.substanceBlocks.length}`);
  log(`policyTitle       : ${prepared.policyTitle?.policyTitle ?? "—"}`);
  log("");
  log("=== EXACT MODEL INPUT ===");
  log("\n--- system ---");
  log(SYSTEM_PROMPT);
  log("\n--- user ---");
  log(buildUserMessage(prepared.input));

  if (generate || write) {
    log("\n=== GENERATED IMPACT ===");
    const result = await generateCitizenImpact(prepared.input);
    const verdict = assessCitizenImpactCoherence({
      impactText: result.citizenImpact,
      policyTitle: prepared.policyTitle?.policyTitle ?? null,
      policySubtitle: prepared.policyTitle?.policySubtitle ?? null,
      blocks: prepared.input.substanceBlocks,
    });
    log(`confidence : ${result.confidence}`);
    log(
      `coherence  : coverage ${verdict.coverage.toFixed(2)} [ref=${verdict.referenceUsed}] → ${verdict.coherent ? "COHERENT" : "INCOHERENT"}`
    );
    log("");
    log(result.citizenImpact);

    if (write) {
      const stats = await generateScrutinCitizenImpacts({ scrutinIds: [scrutinId], force: true });
      log("\n=== WRITE RESULT ===");
      log(JSON.stringify(stats, null, 2));
    }
  }
}

async function main(): Promise<void> {
  if (flag("audit")) {
    await runAudit();
  } else {
    await runSingle();
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
