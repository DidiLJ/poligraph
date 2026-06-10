/**
 * Pipeline Registry
 *
 * Static configuration for all data sync pipelines.
 * Used by the health dashboard to determine expected schedules,
 * acceptable thresholds, and how to look up last-run data.
 */

// ─── Types ──────────────────────────────────────────────────────

export type PipelineFrequency = "daily" | "weekly" | "manual";
export type PipelineSource = "github-actions" | "inngest" | "manual";
export type PipelineCategory = "politicians" | "votes" | "content" | "enrichment" | "elections";

export interface PipelineConfig {
  /** Unique identifier (matches SyncJob.script or SyncMetadata.sourceKey pattern) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category for grouping in dashboard */
  category: PipelineCategory;
  /**
   * When set, the admin dashboard counts entities of this type created
   * in the last 7 days, and shows a conversion rate vs. items processed.
   * Use null/omit when the pipeline doesn't produce countable entities
   * (maintenance jobs, stats computation, photo sync, etc.).
   */
  conversionTarget?: {
    model: "affair" | "factCheck" | "politician";
    /** Optional filter on entity rows by source type. */
    sourceFilter?: "PRESSE" | "JUDILIBRE" | "WIKIDATA" | "WIKIPEDIA";
  };
  /** How often it should run */
  frequency: PipelineFrequency;
  /** What triggers it */
  source: PipelineSource;
  /** Max hours since last successful run before warning */
  warnAfterHours: number;
  /** Max hours since last successful run before critical */
  criticalAfterHours: number;
  /** SyncMetadata sourceKeys to check (OR - any recent = healthy) */
  metadataKeys?: string[];
  /** SyncJob script names to check (OR - any recent = healthy) */
  jobScripts?: string[];
  /** npm script or workflow name (for display) */
  command: string;
  /** Whether this pipeline is currently enabled */
  enabled: boolean;
}

export type PipelineHealthStatus = "healthy" | "warning" | "critical" | "unknown" | "disabled";

export interface PipelineHealth {
  pipeline: PipelineConfig;
  status: PipelineHealthStatus;
  lastRunAt: Date | null;
  lastDurationS: number | null;
  lastItemCount: number | null;
  lastError: string | null;
  hoursSinceLastRun: number | null;
}

export interface PipelineLastRun {
  lastRunAt: Date | null;
  durationS: number | null;
  itemCount: number | null;
  error: string | null;
  status: "completed" | "failed" | "running" | null;
}

// ─── Pure Health Computation ────────────────────────────────────

/**
 * Compute the health status of a pipeline based on its config and last run data.
 * Pure function - no side effects, fully testable.
 */
export function computePipelineHealth(
  config: PipelineConfig,
  lastRun: PipelineLastRun,
  now: Date = new Date()
): PipelineHealth {
  if (!config.enabled) {
    return {
      pipeline: config,
      status: "disabled",
      lastRunAt: lastRun.lastRunAt,
      lastDurationS: lastRun.durationS,
      lastItemCount: lastRun.itemCount,
      lastError: lastRun.error,
      hoursSinceLastRun: lastRun.lastRunAt
        ? (now.getTime() - lastRun.lastRunAt.getTime()) / (1000 * 60 * 60)
        : null,
    };
  }

  if (!lastRun.lastRunAt) {
    return {
      pipeline: config,
      status: "unknown",
      lastRunAt: null,
      lastDurationS: null,
      lastItemCount: null,
      lastError: lastRun.error,
      hoursSinceLastRun: null,
    };
  }

  const hoursSince = (now.getTime() - lastRun.lastRunAt.getTime()) / (1000 * 60 * 60);

  let status: PipelineHealthStatus;
  if (lastRun.status === "failed") {
    status = "critical";
  } else if (hoursSince >= config.criticalAfterHours) {
    status = "critical";
  } else if (hoursSince >= config.warnAfterHours) {
    status = "warning";
  } else {
    status = "healthy";
  }

  return {
    pipeline: config,
    status,
    lastRunAt: lastRun.lastRunAt,
    lastDurationS: lastRun.durationS,
    lastItemCount: lastRun.itemCount,
    lastError: lastRun.error,
    hoursSinceLastRun: hoursSince,
  };
}

// ─── Registry ───────────────────────────────────────────────────

export const PIPELINE_REGISTRY: PipelineConfig[] = [
  // Daily pipelines (Inngest)
  {
    id: "press",
    name: "Revue de presse",
    category: "content",
    conversionTarget: { model: "affair", sourceFilter: "PRESSE" },
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["press-rss"],
    command: "npm run sync:press",
    enabled: true,
  },
  {
    id: "scrutins-an",
    name: "Scrutins AN",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["votes-an-zip"],
    command: "npm run sync:scrutins-an",
    enabled: true,
  },
  {
    id: "scrutins-senat",
    name: "Scrutins Sénat",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["votes-senat"],
    command: "npm run sync:scrutins-senat",
    enabled: true,
  },
  {
    id: "legislation",
    name: "Dossiers législatifs",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 48,
    criticalAfterHours: 120,
    metadataKeys: ["legislation-an"],
    command: "npm run sync:legislation",
    enabled: true,
  },

  // Policy-title pipeline (Inngest, sync-daily steps). Each writes its own
  // SyncMetadata key so freshness is tracked per step. Public-facing + partly
  // AI-driven, so monitored separately rather than as one black box.
  {
    id: "policy-amendments",
    name: "Titres de votes : import amendements",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["policy-titles:amendments"],
    command: "sync-daily (amendments-an)",
    enabled: true,
  },
  {
    id: "policy-link",
    name: "Titres de votes : liaison scrutins",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["policy-titles:link"],
    command: "sync-daily (link-scrutins-amendments)",
    enabled: true,
  },
  {
    id: "policy-generate",
    name: "Titres de votes : génération IA",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["policy-titles:generate"],
    command: "sync-daily (generate-policy-titles)",
    enabled: true,
  },
  {
    id: "policy-approve",
    name: "Titres de votes : auto-approbation",
    category: "votes",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    metadataKeys: ["policy-titles:approve"],
    command: "sync-daily (approve-policy-titles)",
    enabled: true,
  },

  // Weekly pipelines (GitHub Actions)
  {
    id: "deputes",
    name: "Députés (AN)",
    category: "politicians",
    conversionTarget: { model: "politician" },
    frequency: "weekly",
    source: "github-actions",
    warnAfterHours: 192, // 8 days
    criticalAfterHours: 336, // 14 days
    jobScripts: ["sync:assemblee"],
    command: "npm run sync:assemblee",
    enabled: true,
  },
  {
    id: "senateurs",
    name: "Sénateurs",
    category: "politicians",
    conversionTarget: { model: "politician" },
    frequency: "weekly",
    source: "github-actions",
    warnAfterHours: 192,
    criticalAfterHours: 336,
    jobScripts: ["sync:senat"],
    command: "npm run sync:senat",
    enabled: true,
  },
  {
    id: "gouvernement",
    name: "Gouvernement",
    category: "politicians",
    conversionTarget: { model: "politician" },
    frequency: "weekly",
    source: "github-actions",
    warnAfterHours: 192,
    criticalAfterHours: 336,
    jobScripts: ["sync:gouvernement"],
    command: "npm run sync:gouvernement",
    enabled: true,
  },
  {
    id: "careers",
    name: "Carrières (Wikidata)",
    category: "politicians",
    frequency: "weekly",
    source: "github-actions",
    warnAfterHours: 192,
    criticalAfterHours: 336,
    jobScripts: ["sync:careers"],
    command: "npm run sync:careers",
    enabled: true,
  },
  {
    id: "photos",
    name: "Photos",
    category: "politicians",
    frequency: "weekly",
    source: "github-actions",
    warnAfterHours: 192,
    criticalAfterHours: 336,
    jobScripts: ["sync:photos"],
    command: "npm run sync:photos",
    enabled: true,
  },
  {
    id: "deceased",
    name: "Décès (Wikidata)",
    category: "politicians",
    frequency: "weekly",
    source: "github-actions",
    warnAfterHours: 192,
    criticalAfterHours: 336,
    jobScripts: ["sync:deceased"],
    command: "npm run sync:deceased",
    enabled: true,
  },

  // Enrichment (Inngest)
  {
    id: "factchecks",
    name: "Fact-checks",
    category: "enrichment",
    conversionTarget: { model: "factCheck" },
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 48,
    criticalAfterHours: 120,
    metadataKeys: ["factchecks"],
    command: "npm run sync:factchecks",
    enabled: true,
  },
  {
    id: "moderate",
    name: "Modération IA",
    category: "enrichment",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 48,
    criticalAfterHours: 120,
    metadataKeys: ["moderate"],
    command: "npm run sync:moderate",
    enabled: true,
  },
  {
    id: "compute-stats",
    name: "Stats pré-calculées",
    category: "enrichment",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 48,
    criticalAfterHours: 120,
    metadataKeys: ["compute-stats"],
    command: "npm run sync:compute-stats",
    enabled: true,
  },

  // Manual pipelines
  {
    id: "rne-maires",
    name: "Maires (RNE)",
    category: "elections",
    conversionTarget: { model: "politician" },
    frequency: "manual",
    source: "manual",
    warnAfterHours: 720, // 30 days
    criticalAfterHours: 2160, // 90 days
    metadataKeys: ["rne-maires"],
    command: "npm run sync:rne:maires",
    enabled: true,
  },
  {
    id: "hatvp",
    name: "Déclarations HATVP",
    category: "enrichment",
    frequency: "manual",
    source: "manual",
    warnAfterHours: 720,
    criticalAfterHours: 2160,
    metadataKeys: ["hatvp"],
    command: "npm run sync:hatvp",
    enabled: true,
  },
];

/**
 * Get pipeline config by ID
 */
export function getPipelineConfig(id: string): PipelineConfig | undefined {
  return PIPELINE_REGISTRY.find((p) => p.id === id);
}

/**
 * Get pipelines by category
 */
export function getPipelinesByCategory(category: PipelineCategory): PipelineConfig[] {
  return PIPELINE_REGISTRY.filter((p) => p.category === category);
}
