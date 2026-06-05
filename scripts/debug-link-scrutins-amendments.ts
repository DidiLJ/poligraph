/**
 * Debug entry for the scrutin → amendment linker. Wraps
 * `linkScrutinsToAmendments` with explicit flag parsing so the linker can be
 * exercised on a small sample (or a single scrutin) without writing by
 * accident: it dry-runs unless `--write` is passed explicitly.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/debug-link-scrutins-amendments.ts --limit 20
 *   npx dotenv -e .env -- npx tsx scripts/debug-link-scrutins-amendments.ts --scrutin-id <id> --verbose
 *   npx dotenv -e .env -- npx tsx scripts/debug-link-scrutins-amendments.ts --limit 50 --sample-ambiguous
 *   npx dotenv -e .env -- npx tsx scripts/debug-link-scrutins-amendments.ts --limit 50 --write
 */
import { linkScrutinsToAmendments } from "@/services/sync/link-scrutins-to-amendments";

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

async function main() {
  const limitArg = arg("limit");
  const scrutinId = arg("scrutin-id");
  const verbose = flag("verbose");
  const dryRun = !flag("write"); // NEVER write unless --write is explicit
  const sampleAmbiguous = flag("sample-ambiguous");
  const limit = scrutinId ? undefined : limitArg ? Number(limitArg) : 20;

  const stats = await linkScrutinsToAmendments({
    ...(scrutinId ? { scrutinIds: [scrutinId] } : {}),
    limit,
    dryRun,
    verbose,
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(stats, null, 2));

  if (sampleAmbiguous) {
    const codes = new Set([
      "AMBIGUOUS_CANDIDATES",
      "UNSCOPED",
      "CANDIDATE_NOT_FOUND",
      "TARGET_SUB_AMENDMENT_NOT_FOUND",
    ]);
    const sample = stats.warnings.filter((w) => codes.has(w.code)).slice(0, 10);
    // eslint-disable-next-line no-console
    console.log("\n--- sample ambiguous/unresolved ---");
    for (const w of sample) {
      // eslint-disable-next-line no-console
      console.log(`${w.scrutinId}  ${w.code}  ${w.message}`);
    }
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
