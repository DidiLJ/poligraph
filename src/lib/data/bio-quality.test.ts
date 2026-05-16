import { describe, expect, it, vi, beforeEach } from "vitest";
import { getBioQualityBreakdown, BIO_BUCKETS } from "./bio-quality";

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: vi.fn() },
}));

import { db } from "@/lib/db";

describe("getBioQualityBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one row per bucket and joins with raw query results", async () => {
    (db.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { bucket: "Vide", published: 10n, draft: 5n, withCurrent: 3n },
        { bucket: "Rédigée (≥800 car.)", published: 200n, draft: 1n, withCurrent: 150n },
      ])
      .mockResolvedValueOnce([{ total: 36000n, withCurrent: 35000n }]);

    const result = await getBioQualityBreakdown();
    expect(result.buckets).toHaveLength(BIO_BUCKETS.length);
    const vide = result.buckets.find((b) => b.label === "Vide")!;
    expect(vide.publishedCount).toBe(10);
    expect(vide.draftCount).toBe(5);
    expect(vide.currentMandateCount).toBe(3);
    const empty = result.buckets.find((b) => b.label === "Court (200-799 car.)")!;
    expect(empty.publishedCount).toBe(0);
    expect(result.totalPoliticians).toBe(36000);
  });

  it("declares the four expected buckets in order", () => {
    expect(BIO_BUCKETS.map((b) => b.label)).toEqual([
      "Vide",
      "Stub (<200 car.)",
      "Court (200-799 car.)",
      "Rédigée (≥800 car.)",
    ]);
  });
});
