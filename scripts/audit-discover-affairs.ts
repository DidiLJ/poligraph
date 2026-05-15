/**
 * One-shot research script: investigate why discover-affairs (Wikidata + Wikipedia)
 * has produced 0 affairs over the last 90 days.
 *
 * Outputs:
 *   1. SyncMetadata rows for discover-affairs (incremental sync tracking)
 *   2. SyncJob rows for discover-affairs (Inngest job tracking — the real surface,
 *      because the service writes here via markJobRunning/Completed/Failed, NOT to
 *      syncMetadata)
 *   3. Affairs created in the last 90 days sourced WIKIDATA or WIKIPEDIA
 *   4. Politicians eligible for the Wikidata phase (PUBLISHED + has Wikidata Q-ID)
 *   5. Hours since last discover-affairs run (best signal available)
 *
 * Use the output to decide between:
 *   A. Re-enable on a weekly schedule + lower the confidence threshold
 *   B. Restrict scan to politicians without any affair yet
 *   C. Disable one phase (Wikidata or Wikipedia), keep the other
 *   D. Full one-shot backfill across all eligible politicians
 */
import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  // 1. SyncMetadata for discover-affairs (probably empty: the service does not
  // write here, but we probe in case a sibling script does).
  const meta = await db.syncMetadata.findMany({
    where: { sourceKey: { contains: "discover-affairs" } },
    orderBy: { lastSyncAt: "desc" },
    take: 20,
    select: {
      sourceKey: true,
      lastSyncAt: true,
      itemCount: true,
      lastDurationS: true,
    },
  });
  console.log("=== 1. syncMetadata entries (sourceKey LIKE %discover-affairs%) ===");
  if (meta.length === 0) {
    console.log("(no entries found — the service does not write to syncMetadata)");
  } else {
    console.table(
      meta.map((m) => ({
        sourceKey: m.sourceKey,
        lastSyncAt: m.lastSyncAt?.toISOString().slice(0, 16) ?? "(null)",
        itemCount: m.itemCount ?? "—",
        durationS: m.lastDurationS?.toFixed(1) ?? "—",
      }))
    );
  }

  // 2. SyncJob rows for discover-affairs — this is where the Inngest function
  // actually records runs via markJobRunning / markJobCompleted / markJobFailed.
  const jobs = await db.syncJob.findMany({
    where: { script: { contains: "discover-affairs" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      script: true,
      status: true,
      startedAt: true,
      completedAt: true,
      processed: true,
      error: true,
      createdAt: true,
    },
  });
  console.log("\n=== 2. syncJob entries (script LIKE %discover-affairs%) ===");
  if (jobs.length === 0) {
    console.log("(no entries found — discover-affairs has never been invoked via Inngest)");
  } else {
    console.table(
      jobs.map((j) => ({
        id: j.id.slice(0, 8),
        script: j.script,
        status: j.status,
        created: j.createdAt.toISOString().slice(0, 16),
        started: j.startedAt?.toISOString().slice(0, 16) ?? "—",
        completed: j.completedAt?.toISOString().slice(0, 16) ?? "—",
        processed: j.processed ?? "—",
        error: j.error ? j.error.slice(0, 60) : "—",
      }))
    );
  }

  // 3. Affairs sourced WIKIDATA / WIKIPEDIA in last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000);
  const wikiAffairs = await db.affair.findMany({
    where: {
      createdAt: { gte: ninetyDaysAgo },
      sources: { some: { sourceType: { in: ["WIKIDATA", "WIKIPEDIA"] } } },
    },
    select: {
      id: true,
      slug: true,
      createdAt: true,
      publicationStatus: true,
      sources: { select: { sourceType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const wikiCount = await db.affair.count({
    where: {
      createdAt: { gte: ninetyDaysAgo },
      sources: { some: { sourceType: { in: ["WIKIDATA", "WIKIPEDIA"] } } },
    },
  });
  console.log(`\n=== 3. Affairs sourced WIKIDATA/WIKIPEDIA in last 90 days: ${wikiCount} ===`);
  if (wikiAffairs.length > 0) {
    console.table(
      wikiAffairs.map((a) => ({
        id: a.id.slice(0, 8),
        when: a.createdAt.toISOString().slice(0, 10),
        slug: a.slug.slice(0, 50),
        status: a.publicationStatus,
        sources: [...new Set(a.sources.map((s) => s.sourceType))].sort().join(","),
      }))
    );
  } else {
    console.log("(none)");
  }

  // 4. Eligible politicians for Wikidata phase
  const eligibleCount = await db.politician.count({
    where: {
      publicationStatus: "PUBLISHED",
      externalIds: { some: { source: "WIKIDATA" } },
    },
  });
  const totalPublished = await db.politician.count({
    where: { publicationStatus: "PUBLISHED" },
  });
  console.log(
    `\n=== 4. Politicians eligible for Wikidata phase: ${eligibleCount} (of ${totalPublished} published) ===`
  );

  // 5. Hours since latest discover-affairs run (prefer syncJob over syncMetadata)
  console.log("\n=== 5. Most recent discover-affairs run ===");
  const latestJobTime = jobs[0]?.completedAt ?? jobs[0]?.startedAt ?? jobs[0]?.createdAt ?? null;
  const latestMetaTime = meta[0]?.lastSyncAt ?? null;
  const latest =
    latestJobTime && latestMetaTime
      ? latestJobTime > latestMetaTime
        ? { source: "syncJob", time: latestJobTime }
        : { source: "syncMetadata", time: latestMetaTime }
      : latestJobTime
        ? { source: "syncJob", time: latestJobTime }
        : latestMetaTime
          ? { source: "syncMetadata", time: latestMetaTime }
          : null;

  if (latest) {
    const hoursSince = (Date.now() - latest.time.getTime()) / (1000 * 60 * 60);
    console.log(
      `Latest signal from ${latest.source} at ${latest.time.toISOString()} ` +
        `(${hoursSince.toFixed(1)}h ago, ${(hoursSince / 24).toFixed(1)}d)`
    );
  } else {
    console.log("No discover-affairs run on record in syncJob or syncMetadata.");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
