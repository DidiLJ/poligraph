import { db } from "../db";
import { cacheLife, cacheTag } from "next/cache";
import {
  PIPELINE_REGISTRY,
  computePipelineHealth,
  type PipelineConfig,
  type PipelineHealth,
  type PipelineLastRun,
} from "@/config/pipeline-registry";

// ─── DB queries (private) ───────────────────────────────────────

async function getLastRunFromMetadata(keys: string[]): Promise<PipelineLastRun> {
  const rows = await db.syncMetadata.findMany({
    where: { sourceKey: { in: keys } },
    orderBy: { lastSyncAt: "desc" },
    take: 1,
  });

  const row = rows[0];
  if (!row) {
    return { lastRunAt: null, durationS: null, itemCount: null, error: null, status: null };
  }

  return {
    lastRunAt: row.lastSyncAt,
    durationS: row.lastDurationS,
    itemCount: row.itemCount,
    error: null,
    status: row.lastSyncAt ? "completed" : null,
  };
}

async function getLastRunFromJobs(scripts: string[]): Promise<PipelineLastRun> {
  const job = await db.syncJob.findFirst({
    where: { script: { in: scripts } },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    return { lastRunAt: null, durationS: null, itemCount: null, error: null, status: null };
  }

  const durationS =
    job.startedAt && job.completedAt
      ? (job.completedAt.getTime() - job.startedAt.getTime()) / 1000
      : null;

  return {
    lastRunAt: job.completedAt ?? job.startedAt ?? job.createdAt,
    durationS,
    itemCount: job.processed,
    error: job.error,
    status:
      job.status === "COMPLETED"
        ? "completed"
        : job.status === "FAILED"
          ? "failed"
          : job.status === "RUNNING"
            ? "running"
            : null,
  };
}

// ─── Exported functions ─────────────────────────────────────────

async function getLastRunForPipeline(config: PipelineConfig): Promise<PipelineLastRun> {
  const results: PipelineLastRun[] = [];

  if (config.metadataKeys?.length) {
    results.push(await getLastRunFromMetadata(config.metadataKeys));
  }

  if (config.jobScripts?.length) {
    results.push(await getLastRunFromJobs(config.jobScripts));
  }

  if (results.length === 0) {
    return { lastRunAt: null, durationS: null, itemCount: null, error: null, status: null };
  }

  // Pick the most recent successful run across all sources
  return results.reduce((best, current) => {
    if (!current.lastRunAt) return best;
    if (!best.lastRunAt) return current;
    return current.lastRunAt > best.lastRunAt ? current : best;
  });
}

/**
 * Get health status for all registered pipelines.
 * Cached for 5 minutes (admin dashboard refresh).
 */
export async function getPipelineHealthAll(): Promise<PipelineHealth[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("pipelines");

  const now = new Date();
  const results: PipelineHealth[] = [];

  for (const config of PIPELINE_REGISTRY) {
    const lastRun = await getLastRunForPipeline(config);
    results.push(computePipelineHealth(config, lastRun, now));
  }

  return results;
}

/**
 * Get health status for a single pipeline by ID.
 */
export async function getPipelineHealth(id: string): Promise<PipelineHealth | null> {
  const config = PIPELINE_REGISTRY.find((p) => p.id === id);
  if (!config) return null;

  const lastRun = await getLastRunForPipeline(config);
  return computePipelineHealth(config, lastRun);
}

/**
 * Summary stats for the dashboard header.
 */
export async function getPipelinesSummary(): Promise<{
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  disabled: number;
}> {
  const all = await getPipelineHealthAll();

  return {
    total: all.length,
    healthy: all.filter((h) => h.status === "healthy").length,
    warning: all.filter((h) => h.status === "warning").length,
    critical: all.filter((h) => h.status === "critical").length,
    unknown: all.filter((h) => h.status === "unknown").length,
    disabled: all.filter((h) => h.status === "disabled").length,
  };
}
