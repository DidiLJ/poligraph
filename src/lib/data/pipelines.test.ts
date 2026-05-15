import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    affair: { count: vi.fn() },
    factCheck: { count: vi.fn() },
    politician: { count: vi.fn() },
    syncMetadata: { aggregate: vi.fn() },
  },
}));

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPipelineConversionMetrics } from "./pipelines";
import { db } from "@/lib/db";

describe("getPipelineConversionMetrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
    vi.spyOn(db.syncMetadata, "aggregate").mockResolvedValue({
      _sum: { itemCount: null },
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns entitiesCreated count for press over the last 7 days with sourceType filter", async () => {
    const spy = vi.spyOn(db.affair, "count").mockResolvedValueOnce(26 as never);

    const result = await getPipelineConversionMetrics("press");

    expect(result).not.toBeNull();
    expect(result?.entitiesCreated7d).toBe(26);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: expect.any(Date) },
          sources: { some: { sourceType: "PRESSE" } },
        }),
      })
    );
  });

  it("returns null for pipelines without conversionTarget", async () => {
    const result = await getPipelineConversionMetrics("photos");
    expect(result).toBeNull();
  });

  it("returns null for unknown pipeline id", async () => {
    const result = await getPipelineConversionMetrics("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns zero entitiesCreated when no entities match", async () => {
    vi.spyOn(db.affair, "count").mockResolvedValueOnce(0 as never);
    const result = await getPipelineConversionMetrics("press");
    expect(result?.entitiesCreated7d).toBe(0);
  });

  it("queries factCheck model when target.model is factCheck", async () => {
    const spy = vi.spyOn(db.factCheck, "count").mockResolvedValueOnce(8 as never);
    const result = await getPipelineConversionMetrics("factchecks");
    expect(result?.entitiesCreated7d).toBe(8);
    expect(spy).toHaveBeenCalled();
  });

  it("queries politician model when target.model is politician", async () => {
    const spy = vi.spyOn(db.politician, "count").mockResolvedValueOnce(150 as never);
    const result = await getPipelineConversionMetrics("rne-maires");
    expect(result?.entitiesCreated7d).toBe(150);
    expect(spy).toHaveBeenCalled();
  });
});

describe("getPipelineConversionMetrics — conversionRate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("computes conversionRate = entitiesCreated / itemsProcessedLast7d", async () => {
    vi.spyOn(db.affair, "count").mockResolvedValueOnce(26 as never);
    vi.spyOn(db.syncMetadata, "aggregate").mockResolvedValueOnce({
      _sum: { itemCount: 200 },
    } as never);

    const result = await getPipelineConversionMetrics("press");
    expect(result?.conversionRate).toBeCloseTo(0.13, 2); // 26 / 200 = 0.13
  });

  it("returns conversionRate 0 when itemCount sum is 0", async () => {
    vi.spyOn(db.affair, "count").mockResolvedValueOnce(5 as never);
    vi.spyOn(db.syncMetadata, "aggregate").mockResolvedValueOnce({
      _sum: { itemCount: 0 },
    } as never);
    const result = await getPipelineConversionMetrics("press");
    expect(result?.conversionRate).toBe(0);
  });

  it("returns conversionRate 0 when itemCount sum is null (no syncMetadata rows)", async () => {
    vi.spyOn(db.affair, "count").mockResolvedValueOnce(5 as never);
    vi.spyOn(db.syncMetadata, "aggregate").mockResolvedValueOnce({
      _sum: { itemCount: null },
    } as never);
    const result = await getPipelineConversionMetrics("press");
    expect(result?.conversionRate).toBe(0);
  });
});
