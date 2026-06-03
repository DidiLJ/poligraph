/**
 * Debug entry for the policy-title generator. Wraps `generateScrutinPolicyTitles`
 * with explicit flag parsing and a structured per-scrutin review block, so the
 * generator can be exercised on a small sample (or a single scrutin) without
 * writing by accident: it dry-runs unless `--write` is passed explicitly.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/debug-scrutin-policy-title.ts --limit 5
 *   npx dotenv -e .env -- npx tsx scripts/debug-scrutin-policy-title.ts --scrutin-id <id> --verbose
 *   npx dotenv -e .env -- npx tsx scripts/debug-scrutin-policy-title.ts --limit 10 --skip-llm
 *   npx dotenv -e .env -- npx tsx scripts/debug-scrutin-policy-title.ts --limit 5 --write
 */
import { generateScrutinPolicyTitles } from "@/services/sync/generate-scrutin-policy-titles";
import type { GenerateResult } from "@/services/scrutin-policy-title/types";

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

function outcomeLabel(r: GenerateResult): string {
  if (r.outcome === "skipped") return `skipped(${r.skipReason ?? "?"})`;
  return r.outcome;
}

function printBlock(r: GenerateResult, verbose: boolean, write: boolean): void {
  const d = r.debug;
  log(`─── ${r.scrutinId} ───────────────────────────────`);
  log(`officialTitle   : ${d?.officialTitle ?? "(not loaded — use --verbose)"}`);
  log(`proceduralLabel : ${d?.proceduralLabel ?? "—"}`);
  const links = d?.links ? d.links.map((l) => `${l.role} n°${l.amendmentNumber}`).join(", ") : "—";
  log(`links           : ${links}`);
  log(`substanceDepth  : ${d?.substanceDepth ?? "null"}`);
  log(`policyTitle     : ${r.policyTitle ?? "(fallback — none)"}`);
  log(`policySubtitle  : ${r.policySubtitle ?? "—"}`);
  const quotes = d?.evidenceQuotes
    ? JSON.stringify(
        d.evidenceQuotes.map((q) => ({
          sourceType: q.sourceType,
          sourceId: q.sourceId,
          field: q.field,
          quote: q.quote.slice(0, 80),
        }))
      )
    : "[]";
  log(`evidenceQuotes  : ${quotes}`);
  const validators =
    r.warnings.length > 0 ? r.warnings.map((w) => `${w.code}(${w.severity})`).join(", ") : "none";
  log(`validators      : ${validators}`);
  log(`confidence/status: ${r.confidence ?? "—"} / ${r.status ?? "—"}`);
  const wouldWrite = !write ? "no" : r.outcome === "skipped" ? "no" : "yes";
  log(`outcome         : ${outcomeLabel(r)}   would-write: ${wouldWrite}`);

  if (verbose && d) {
    if (d.prompt) {
      log("\n--- prompt.system ---");
      log(d.prompt.system);
      log("\n--- prompt.user ---");
      log(d.prompt.user);
    }
    if (d.rawLlmText) {
      log("\n--- raw LLM text ---");
      log(d.rawLlmText);
    }
  }
  log();
}

async function main() {
  const scrutinId = arg("scrutin-id");
  const limitArg = arg("limit");
  const skipLlm = flag("skip-llm");
  const verbose = flag("verbose");
  const write = flag("write"); // NEVER write unless --write is explicit
  const limit = scrutinId ? undefined : limitArg ? Number(limitArg) : 5;
  const modelVersionDate = new Date().toISOString().slice(0, 10);

  const stats = await generateScrutinPolicyTitles({
    ...(scrutinId ? { scrutinIds: [scrutinId] } : {}),
    ...(limit !== undefined ? { limit } : {}),
    skipLlm,
    verbose,
    dryRun: !write,
    modelVersionDate,
  });

  for (const r of stats.results) {
    printBlock(r, verbose, write);
  }

  log("=== aggregate stats ===");
  const { results: _results, ...aggregate } = stats;
  log(JSON.stringify(aggregate, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
