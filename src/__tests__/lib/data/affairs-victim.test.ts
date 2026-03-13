import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    affair: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getVictimStats } from "@/lib/data/affairs";

describe("getVictimStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns counts for victim/plaintiff affairs", async () => {
    const mockCount = vi.mocked(db.affair.count);
    const mockFindMany = vi.mocked(db.affair.findMany);

    mockCount.mockResolvedValueOnce(12);
    mockFindMany.mockResolvedValueOnce([
      { politicianId: "a" },
      { politicianId: "b" },
      { politicianId: "c" },
    ] as Awaited<ReturnType<typeof db.affair.findMany>>);
    mockCount.mockResolvedValueOnce(5);

    const stats = await getVictimStats();

    expect(stats).toEqual({
      totalAffairs: 12,
      totalPoliticians: 3,
      ongoingProcedures: 5,
    });

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publicationStatus: "PUBLISHED",
          involvement: { in: ["VICTIM", "PLAINTIFF"] },
        }),
      })
    );
  });
});
