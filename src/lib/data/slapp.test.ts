import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    affair: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getSlappAffairs, getSlappStats } from "./slapp";

describe("getSlappAffairs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre par isSlapp=true et publicationStatus=PUBLISHED par défaut", async () => {
    vi.mocked(db.affair.findMany).mockResolvedValue([]);
    await getSlappAffairs({});
    expect(db.affair.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isSlapp: true,
          publicationStatus: "PUBLISHED",
        }),
      })
    );
  });

  it("limite la sortie via take", async () => {
    vi.mocked(db.affair.findMany).mockResolvedValue([]);
    await getSlappAffairs({ limit: 5 });
    expect(db.affair.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});

describe("getSlappStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne un total et le breakdown par status", async () => {
    vi.mocked(db.affair.count).mockResolvedValue(12);
    vi.mocked(db.affair.groupBy).mockResolvedValue([
      { status: "PROCES_EN_COURS", _count: { _all: 7 } } as never,
      { status: "RELAXE", _count: { _all: 5 } } as never,
    ]);
    const stats = await getSlappStats();
    expect(stats.total).toBe(12);
    expect(stats.byStatus.PROCES_EN_COURS).toBe(7);
    expect(stats.byStatus.RELAXE).toBe(5);
  });
});
