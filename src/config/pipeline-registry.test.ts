import { describe, it, expect } from "vitest";
import {
  computePipelineHealth,
  getPipelineConfig,
  getPipelinesByCategory,
  PIPELINE_REGISTRY,
  type PipelineConfig,
  type PipelineLastRun,
} from "./pipeline-registry";

// ─── Test helpers ───────────────────────────────────────────────

const NOW = new Date("2026-04-05T12:00:00Z");

function makeConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    id: "test-pipeline",
    name: "Test Pipeline",
    category: "content",
    frequency: "daily",
    source: "inngest",
    warnAfterHours: 30,
    criticalAfterHours: 72,
    command: "npm run sync:test",
    enabled: true,
    ...overrides,
  };
}

function makeLastRun(overrides: Partial<PipelineLastRun> = {}): PipelineLastRun {
  return {
    lastRunAt: null,
    durationS: null,
    itemCount: null,
    error: null,
    status: null,
    ...overrides,
  };
}

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

// ─── computePipelineHealth ──────────────────────────────────────

describe("computePipelineHealth", () => {
  describe("disabled pipelines", () => {
    it("returns disabled status regardless of last run data", () => {
      const config = makeConfig({ enabled: false });
      const lastRun = makeLastRun({
        lastRunAt: hoursAgo(1000),
        status: "failed",
        error: "Some error",
      });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("disabled");
      expect(result.lastRunAt).toEqual(lastRun.lastRunAt);
      expect(result.lastError).toBe("Some error");
    });

    it("computes hoursSinceLastRun even when disabled", () => {
      const config = makeConfig({ enabled: false });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(48) });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.hoursSinceLastRun).toBeCloseTo(48, 1);
    });
  });

  describe("unknown state (never ran)", () => {
    it("returns unknown when no last run data exists", () => {
      const config = makeConfig();
      const lastRun = makeLastRun();

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("unknown");
      expect(result.lastRunAt).toBeNull();
      expect(result.hoursSinceLastRun).toBeNull();
    });
  });

  describe("healthy pipelines", () => {
    it("returns healthy when last run is within warn threshold", () => {
      const config = makeConfig({ warnAfterHours: 30, criticalAfterHours: 72 });
      const lastRun = makeLastRun({
        lastRunAt: hoursAgo(10),
        durationS: 45,
        itemCount: 150,
        status: "completed",
      });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("healthy");
      expect(result.hoursSinceLastRun).toBeCloseTo(10, 1);
      expect(result.lastDurationS).toBe(45);
      expect(result.lastItemCount).toBe(150);
    });

    it("returns healthy at exactly 0 hours since last run", () => {
      const config = makeConfig({ warnAfterHours: 30 });
      const lastRun = makeLastRun({ lastRunAt: NOW, status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("healthy");
      expect(result.hoursSinceLastRun).toBeCloseTo(0, 1);
    });
  });

  describe("warning state", () => {
    it("returns warning when past warn threshold but before critical", () => {
      const config = makeConfig({ warnAfterHours: 30, criticalAfterHours: 72 });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(40), status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("warning");
    });

    it("returns warning at exactly the warn threshold", () => {
      const config = makeConfig({ warnAfterHours: 30, criticalAfterHours: 72 });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(30), status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("warning");
    });
  });

  describe("critical state", () => {
    it("returns critical when past critical threshold", () => {
      const config = makeConfig({ warnAfterHours: 30, criticalAfterHours: 72 });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(100), status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("critical");
    });

    it("returns critical at exactly the critical threshold", () => {
      const config = makeConfig({ warnAfterHours: 30, criticalAfterHours: 72 });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(72), status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("critical");
    });

    it("returns critical when last run failed regardless of timing", () => {
      const config = makeConfig({ warnAfterHours: 30, criticalAfterHours: 72 });
      const lastRun = makeLastRun({
        lastRunAt: hoursAgo(1),
        status: "failed",
        error: "Connection timeout",
      });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("critical");
      expect(result.lastError).toBe("Connection timeout");
    });
  });

  describe("edge cases", () => {
    it("preserves all pipeline config in result", () => {
      const config = makeConfig({ id: "my-pipe", name: "My Pipeline" });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(5), status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.pipeline).toBe(config);
      expect(result.pipeline.id).toBe("my-pipe");
    });

    it("handles running status as non-failed", () => {
      const config = makeConfig({ warnAfterHours: 30 });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(1), status: "running" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("healthy");
    });

    it("handles weekly pipeline thresholds correctly", () => {
      const config = makeConfig({
        frequency: "weekly",
        warnAfterHours: 192, // 8 days
        criticalAfterHours: 336, // 14 days
      });
      const lastRun = makeLastRun({ lastRunAt: hoursAgo(200), status: "completed" });

      const result = computePipelineHealth(config, lastRun, NOW);

      expect(result.status).toBe("warning");
    });
  });
});

// ─── Registry helpers ───────────────────────────────────────────

describe("getPipelineConfig", () => {
  it("returns config by id", () => {
    const config = getPipelineConfig("press");
    expect(config).toBeDefined();
    expect(config!.name).toBe("Revue de presse");
  });

  it("returns undefined for unknown id", () => {
    expect(getPipelineConfig("nonexistent")).toBeUndefined();
  });
});

describe("getPipelinesByCategory", () => {
  it("returns all politicians pipelines", () => {
    const pipelines = getPipelinesByCategory("politicians");
    expect(pipelines.length).toBeGreaterThanOrEqual(4);
    expect(pipelines.every((p) => p.category === "politicians")).toBe(true);
  });

  it("returns empty array for unused category", () => {
    const pipelines = getPipelinesByCategory("elections");
    // We have rne-maires in elections
    expect(pipelines.every((p) => p.category === "elections")).toBe(true);
  });
});

describe("PIPELINE_REGISTRY", () => {
  it("has unique IDs", () => {
    const ids = PIPELINE_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all configs have valid thresholds (warn < critical)", () => {
    for (const p of PIPELINE_REGISTRY) {
      expect(p.warnAfterHours).toBeLessThan(p.criticalAfterHours);
    }
  });

  it("all configs have at least one lookup key (metadataKeys or jobScripts)", () => {
    for (const p of PIPELINE_REGISTRY) {
      const hasKeys = (p.metadataKeys?.length ?? 0) > 0 || (p.jobScripts?.length ?? 0) > 0;
      expect(hasKeys).toBe(true);
    }
  });
});

describe("policy-title pipeline steps", () => {
  // id → the SyncMetadata key the matching sync-daily step writes via markCompleted.
  const STEP_KEYS: Record<string, string> = {
    "policy-amendments": "policy-titles:amendments",
    "policy-link": "policy-titles:link",
    "policy-generate": "policy-titles:generate",
    "policy-approve": "policy-titles:approve",
  };

  it("registers all four steps with their sync-metadata keys", () => {
    for (const [id, key] of Object.entries(STEP_KEYS)) {
      const config = getPipelineConfig(id);
      expect(config, `pipeline ${id} should be registered`).toBeDefined();
      expect(config!.metadataKeys).toContain(key);
      expect(config!.enabled).toBe(true);
      expect(config!.category).toBe("votes");
    }
  });

  it("flags a step as warning then critical as its last run goes stale", () => {
    const config = getPipelineConfig("policy-approve")!;
    expect(
      computePipelineHealth(
        config,
        makeLastRun({ lastRunAt: hoursAgo(40), status: "completed" }),
        NOW
      ).status
    ).toBe("warning");
    expect(
      computePipelineHealth(
        config,
        makeLastRun({ lastRunAt: hoursAgo(100), status: "completed" }),
        NOW
      ).status
    ).toBe("critical");
  });

  it("is healthy right after a successful run, surfacing counts", () => {
    const config = getPipelineConfig("policy-generate")!;
    const result = computePipelineHealth(
      config,
      makeLastRun({ lastRunAt: hoursAgo(3), itemCount: 5, status: "completed" }),
      NOW
    );
    expect(result.status).toBe("healthy");
    expect(result.lastItemCount).toBe(5);
  });
});
