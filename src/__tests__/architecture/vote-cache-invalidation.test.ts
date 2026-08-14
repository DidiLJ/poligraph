import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function normalized(source: string): string {
  return source.replace(/\s+/g, " ");
}

function expectInOrder(source: string, markers: string[]): void {
  let previousIndex = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker, previousIndex + 1);
    expect(index, `Marqueur absent ou mal ordonné: ${marker}`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

describe("architecture d'invalidation du cache des votes", () => {
  const grouped = withoutComments(read("src/inngest/functions/sync-scrutins.ts"));
  const dailyInngest = withoutComments(read("src/inngest/functions/sync-daily.ts"));
  const wrappers = withoutComments(read("src/inngest/index.ts"));
  const localInvalidation = withoutComments(read("src/inngest/vote-cache.ts"));
  const dailyScript = withoutComments(read("scripts/sync-daily.ts"));
  const remoteInvalidation = withoutComments(read("scripts/lib/revalidate-cache.ts"));
  const remoteCli = withoutComments(read("scripts/revalidate-cache.ts"));
  const dailyWorkflow = read(".github/workflows/sync-daily.yml");
  const weeklyWorkflow = read(".github/workflows/sync-scrutins-an.yml");

  it("lie les deux writes du sync Inngest groupé à l'invalidation", () => {
    expect(normalized(grouped)).toContain(
      "runVoteSyncWithCacheInvalidation(() => syncScrutinsAN(undefined, false, true) )"
    );
    expect(normalized(grouped)).toContain(
      "runVoteSyncWithCacheInvalidation(() => syncScrutinsSenat(null, false, true))"
    );
  });

  it("lie les étapes AN et Sénat du daily Inngest à l'invalidation", () => {
    expect(normalized(dailyInngest)).toContain(
      "runVoteSyncWithCacheInvalidation(() => syncScrutinsAN(undefined, false, true))"
    );
    expect(normalized(dailyInngest)).toContain(
      "runVoteSyncWithCacheInvalidation(() => syncScrutinsSenat(null, false, true))"
    );
  });

  it("lie les wrappers individuels AN et Sénat à l'invalidation", () => {
    const anWrapper = wrappers.slice(
      wrappers.indexOf('createSyncFunction("sync-scrutins-an"'),
      wrappers.indexOf('createSyncFunction("sync-scrutins-senat"')
    );
    const senatWrapper = wrappers.slice(
      wrappers.indexOf('createSyncFunction("sync-scrutins-senat"'),
      wrappers.indexOf('createSyncFunction("sync-press-analysis"')
    );

    expect(anWrapper).toContain("runVoteSyncWithCacheInvalidation");
    expect(anWrapper).toContain("syncScrutinsAN(undefined, false, todayOnly)");
    expect(senatWrapper).toContain("runVoteSyncWithCacheInvalidation");
    expect(senatWrapper).toContain("syncScrutinsSenat(null, false, todayOnly)");
  });

  it("invalide seulement après la résolution réussie du service Inngest", () => {
    expectInOrder(localInvalidation, [
      "const result = await sync()",
      'revalidateTags(["votes"], "max")',
      "return result",
    ]);
  });

  it("lie le GitHub Daily à une revalidation distante authentifiée et obligatoire", () => {
    expect(dailyWorkflow).toContain("CRON_SECRET: ${{ secrets.CRON_SECRET }}");
    expect(dailyWorkflow).toContain("NEXT_PUBLIC_BASE_URL:");
    expect(dailyWorkflow).toContain("run: npm run sync:daily");
    expectInOrder(dailyScript, [
      "scripts/sync-scrutins-an.ts --today",
      "scripts/sync-scrutins-senat.ts --today",
      'name: "Cache revalidation"',
      'revalidateRemoteCache(["votes", "dossiers", "stats", "politicians"])',
    ]);
    expect(dailyScript).toContain("...(!DRY_RUN");
  });

  it("lie le GitHub weekly AN à la revalidation distante après succès", () => {
    expect(weeklyWorkflow).toContain("CRON_SECRET: ${{ secrets.CRON_SECRET }}");
    expect(weeklyWorkflow).toContain("NEXT_PUBLIC_BASE_URL:");
    expectInOrder(weeklyWorkflow, [
      "npm run sync:scrutins-an",
      "name: Revalidate votes cache",
      "run: npm run cache:revalidate -- votes",
    ]);
  });

  it("impose endpoint, tag, authentification et échec HTTP fail-closed", () => {
    expect(remoteCli).toContain("revalidateRemoteCache(tags)");
    expect(remoteCli).toContain("process.exit(1)");
    expect(remoteInvalidation).toContain("/api/cron/revalidate");
    expect(remoteInvalidation).toContain("Authorization: `Bearer ${secret}`");
    expect(remoteInvalidation).toContain("body: JSON.stringify({ tags })");
    expect(remoteInvalidation).toContain("if (!response.ok)");
    expect(remoteInvalidation).toContain("if (!secret)");
    expect(remoteInvalidation).not.toContain("all: true");
  });
});
