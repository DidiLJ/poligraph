import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    pressArticle: { findMany: vi.fn(), update: vi.fn() },
    promise: { create: vi.fn() },
  },
}));

vi.mock("@/services/promises/extractor", () => ({
  extractPromisesFromText: vi.fn(),
}));

vi.mock("@/services/promises/theme-classifier", () => ({
  classifyTheme: vi.fn(),
}));

import { db } from "@/lib/db";
import { extractPromisesFromText } from "@/services/promises/extractor";
import { classifyTheme } from "@/services/promises/theme-classifier";
import { ingestPromisesFromPress } from "@/services/promises/press-source";

beforeEach(() => vi.clearAllMocks());

describe("ingestPromisesFromPress", () => {
  it("retourne le compte d'articles scannés et de promesses extraites", async () => {
    vi.mocked(db.pressArticle.findMany).mockResolvedValueOnce([
      {
        id: "a1",
        title: "Titre",
        description: "Le candidat propose de baisser les impôts.",
        url: "https://example.fr/article",
        feedSource: "lemonde",
        publishedAt: new Date("2026-05-01"),
        mentions: [{ politicianId: "p1", politician: { id: "p1", fullName: "Jean Dupont" } }],
      },
    ] as never);
    vi.mocked(extractPromisesFromText).mockResolvedValueOnce([
      { text: "Baisser les impôts pour les classes moyennes", confidence: 0.9 },
    ]);
    vi.mocked(classifyTheme).mockResolvedValueOnce({
      theme: "ECONOMIE_BUDGET",
      confidence: 0.8,
      method: "rules",
    });
    vi.mocked(db.promise.create).mockResolvedValueOnce({} as never);
    vi.mocked(db.pressArticle.update).mockResolvedValueOnce({} as never);

    const result = await ingestPromisesFromPress({ limit: 1 });

    expect(result).toEqual({ scanned: 1, extracted: 1, inserted: 1 });
    expect(db.promise.create).toHaveBeenCalledOnce();
    expect(db.pressArticle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ promiseScanStatus: "scanned" }) })
    );
  });

  it("marque l'article 'skipped' s'il n'y a pas de promesse extraite", async () => {
    vi.mocked(db.pressArticle.findMany).mockResolvedValueOnce([
      {
        id: "a2",
        title: "Titre",
        description: null,
        url: "https://example.fr/article2",
        feedSource: "mediapart",
        publishedAt: new Date(),
        mentions: [{ politicianId: "p2", politician: { id: "p2", fullName: "Anne Martin" } }],
      },
    ] as never);
    vi.mocked(extractPromisesFromText).mockResolvedValueOnce([]);

    await ingestPromisesFromPress({ limit: 1 });

    expect(db.promise.create).not.toHaveBeenCalled();
    expect(db.pressArticle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ promiseScanStatus: "skipped" }) })
    );
  });

  it("dryRun n'écrit rien en DB", async () => {
    vi.mocked(db.pressArticle.findMany).mockResolvedValueOnce([
      {
        id: "a3",
        title: "T",
        description: null,
        url: "https://example.fr/a3",
        feedSource: "politico",
        publishedAt: new Date(),
        mentions: [{ politicianId: "p3", politician: { id: "p3", fullName: "Test" } }],
      },
    ] as never);
    vi.mocked(extractPromisesFromText).mockResolvedValueOnce([
      { text: "Une promesse longue d'au moins onze caractères", confidence: 0.5 },
    ]);

    const result = await ingestPromisesFromPress({ dryRun: true, limit: 1 });

    expect(result.extracted).toBe(1);
    expect(db.promise.create).not.toHaveBeenCalled();
    expect(db.pressArticle.update).not.toHaveBeenCalled();
  });
});
