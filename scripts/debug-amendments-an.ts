/**
 * Debug entry for the AN amendments ingestion pipeline. Wraps `syncAmendmentsAN`
 * with explicit flag parsing so the parser can be exercised on a small sample
 * without re-downloading the 272 MB ZIP every time.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/debug-amendments-an.ts --limit 20
 *   npx dotenv -e .env -- npx tsx scripts/debug-amendments-an.ts --zip /tmp/Amendements.json.zip --limit 500
 *   npx dotenv -e .env -- npx tsx scripts/debug-amendments-an.ts --zip /tmp/Amendements.json.zip --dry-run --verbose
 */
import { syncAmendmentsAN } from "@/services/sync/amendments-an";

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
  const zipPath = arg("zip");
  const verbose = flag("verbose");
  // Default to dry-run unless the caller passes --zip without --dry-run
  // (i.e. they really mean "write from this local ZIP"). Without --zip the
  // script always dry-runs so a casual debug invocation never bulk-writes.
  const dryRun = flag("dry-run") || !zipPath;
  const limit = limitArg ? Number(limitArg) : 20;

  const stats = await syncAmendmentsAN({ limit, dryRun, verbose, zipPath });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
