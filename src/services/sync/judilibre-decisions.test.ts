// Tests skipped 2026-05-15: pipeline disabled per Option C.
// See docs/superpowers/audits/2026-05-15-judilibre-no-match-audit.md.
// Tests preserved as documentation of the resolver's previous behavior;
// they may be reactivated if Option D is implemented.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataSource, Judgement, MatchMethod } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Mock db
// ---------------------------------------------------------------------------

const mockFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    identityDecision: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import {
  loadJudilibreDecisionCache,
  persistJudilibreDecision,
  type JudilibreMatchEvidence,
} from "./judilibre-decisions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeDecision(overrides: {
  sourceId: string;
  politicianId: string;
  judgement: typeof Judgement.SAME | typeof Judgement.NOT_SAME | typeof Judgement.UNDECIDED;
  confidence?: number;
}) {
  return {
    sourceId: overrides.sourceId,
    politicianId: overrides.politicianId,
    judgement: overrides.judgement,
    confidence: overrides.confidence ?? 0.9,
  };
}

const baseEvidence: JudilibreMatchEvidence = {
  nameQuality: "exact",
  contextSignal: "none",
  score: 0.85,
  fullNameFound: true,
  legalTitleFound: false,
  proximityFound: false,
  jurisdictionCity: null,
};

// ---------------------------------------------------------------------------
// loadJudilibreDecisionCache
// ---------------------------------------------------------------------------

describe.skip("[disabled 2026-05-15] loadJudilibreDecisionCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty cache when no decisions exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const cache = await loadJudilibreDecisionCache();

    expect(cache.size).toEqual({ blocked: 0, confirmed: 0 });
    expect(cache.isBlocked("dec-1", "pol-1")).toBe(false);
    expect(cache.getConfirmed("dec-1", "pol-1")).toBeNull();
  });

  it("queries JUDILIBRE decisions with supersededBy=null", async () => {
    mockFindMany.mockResolvedValue([]);

    await loadJudilibreDecisionCache();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        sourceType: DataSource.JUDILIBRE,
        supersededBy: null,
      },
      select: {
        sourceId: true,
        politicianId: true,
        judgement: true,
        confidence: true,
      },
    });
  });

  it("indexes NOT_SAME decisions as blocked", async () => {
    mockFindMany.mockResolvedValue([
      fakeDecision({
        sourceId: "dec-123",
        politicianId: "pol-abc",
        judgement: Judgement.NOT_SAME,
      }),
    ]);

    const cache = await loadJudilibreDecisionCache();

    expect(cache.isBlocked("dec-123", "pol-abc")).toBe(true);
    expect(cache.isBlocked("dec-123", "pol-other")).toBe(false);
    expect(cache.isBlocked("dec-other", "pol-abc")).toBe(false);
    expect(cache.size.blocked).toBe(1);
    expect(cache.size.confirmed).toBe(0);
  });

  it("indexes SAME decisions as confirmed", async () => {
    mockFindMany.mockResolvedValue([
      fakeDecision({
        sourceId: "dec-456",
        politicianId: "pol-xyz",
        judgement: Judgement.SAME,
        confidence: 0.97,
      }),
    ]);

    const cache = await loadJudilibreDecisionCache();

    const result = cache.getConfirmed("dec-456", "pol-xyz");
    expect(result).toEqual({ confidence: 0.97, politicianId: "pol-xyz" });
    expect(cache.getConfirmed("dec-456", "pol-other")).toBeNull();
    expect(cache.size.confirmed).toBe(1);
    expect(cache.size.blocked).toBe(0);
  });

  it("handles mixed batch: NOT_SAME + SAME + UNDECIDED", async () => {
    mockFindMany.mockResolvedValue([
      fakeDecision({
        sourceId: "dec-1",
        politicianId: "pol-a",
        judgement: Judgement.NOT_SAME,
      }),
      fakeDecision({
        sourceId: "dec-2",
        politicianId: "pol-b",
        judgement: Judgement.SAME,
        confidence: 0.95,
      }),
      fakeDecision({
        sourceId: "dec-3",
        politicianId: "pol-c",
        judgement: Judgement.UNDECIDED,
        confidence: 0.8,
      }),
      fakeDecision({
        sourceId: "dec-4",
        politicianId: "pol-a",
        judgement: Judgement.SAME,
        confidence: 0.99,
      }),
    ]);

    const cache = await loadJudilibreDecisionCache();

    expect(cache.size).toEqual({ blocked: 1, confirmed: 2 });

    // NOT_SAME
    expect(cache.isBlocked("dec-1", "pol-a")).toBe(true);

    // SAME entries
    expect(cache.getConfirmed("dec-2", "pol-b")).toEqual({
      confidence: 0.95,
      politicianId: "pol-b",
    });
    expect(cache.getConfirmed("dec-4", "pol-a")).toEqual({
      confidence: 0.99,
      politicianId: "pol-a",
    });

    // UNDECIDED is ignored
    expect(cache.isBlocked("dec-3", "pol-c")).toBe(false);
    expect(cache.getConfirmed("dec-3", "pol-c")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// persistJudilibreDecision
// ---------------------------------------------------------------------------

describe.skip("[disabled 2026-05-15] persistJudilibreDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates record with correct fields", async () => {
    mockCreate.mockResolvedValue({} as never);

    await persistJudilibreDecision({
      decisionId: "dec-789",
      politicianId: "pol-def",
      judgement: Judgement.SAME,
      confidence: 0.96,
      method: MatchMethod.NAME_ONLY,
      evidence: baseEvidence,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        sourceType: DataSource.JUDILIBRE,
        sourceId: "dec-789",
        politicianId: "pol-def",
        judgement: Judgement.SAME,
        confidence: 0.96,
        method: MatchMethod.NAME_ONLY,
        evidence: baseEvidence,
        decidedBy: "system:sync-judilibre",
      },
    });
  });

  it("does not throw on DB error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("unique constraint violation"));

    await expect(
      persistJudilibreDecision({
        decisionId: "dec-fail",
        politicianId: "pol-fail",
        judgement: Judgement.NOT_SAME,
        confidence: 1.0,
        method: MatchMethod.MANUAL,
        evidence: baseEvidence,
      })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[judilibre-decisions] Failed to persist decision:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
