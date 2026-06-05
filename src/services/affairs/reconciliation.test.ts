import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    affair: { findMany: vi.fn() },
    dismissedDuplicate: { findMany: vi.fn() },
  },
}));

vi.mock("./matching", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./matching")>();
  return { ...actual, findMatchingAffairs: vi.fn() };
});

import { findPotentialDuplicates } from "./reconciliation";
import { db } from "@/lib/db";
import { findMatchingAffairs } from "./matching";

const mockedAffairFindMany = db.affair.findMany as ReturnType<typeof vi.fn>;
const mockedDismissedFindMany = db.dismissedDuplicate.findMany as ReturnType<typeof vi.fn>;
const mockedFindMatchingAffairs = findMatchingAffairs as ReturnType<typeof vi.fn>;

function makeDraft(
  id: string,
  overrides: Partial<{
    title: string;
    category: string;
    createdAt: Date;
    publicationStatus: string;
    politicianId: string;
  }> = {}
) {
  return {
    id,
    title: overrides.title ?? `Affaire ${id}`,
    ecli: null,
    pourvoiNumber: null,
    caseNumbers: [],
    category: overrides.category ?? "AUTRE",
    verdictDate: null,
    politicianId: overrides.politicianId ?? "p1",
    createdAt: overrides.createdAt ?? new Date("2026-05-19T10:00:00Z"),
    publicationStatus: overrides.publicationStatus ?? "DRAFT",
    sources: [],
  };
}

describe("findPotentialDuplicates — draft window clustering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDismissedFindMany.mockResolvedValue([]);
    mockedFindMatchingAffairs.mockResolvedValue([]);
  });

  it("clusters same-politician drafts created within the window across sibling categories", async () => {
    // Scénario type cluster Philippe : titres divergents, catégories sœurs, créés à quelques jours
    mockedAffairFindMany.mockResolvedValue([
      makeDraft("a1", {
        title: "Affaire de gestion présumée illégale au Havre",
        category: "DETOURNEMENT_FONDS_PUBLICS",
        createdAt: new Date("2026-05-19T19:14:00Z"),
      }),
      makeDraft("a2", {
        title: "Enquête pour favoritisme dans l'attribution d'une convention",
        category: "FAVORITISME",
        createdAt: new Date("2026-05-20T12:15:00Z"),
      }),
      makeDraft("a3", {
        title: "Affaire Edouard Philippe au Havre",
        category: "AUTRE",
        createdAt: new Date("2026-05-26T05:09:00Z"),
      }),
    ]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(3); // a1-a2, a1-a3, a2-a3
    for (const pair of duplicates) {
      expect(pair.matchedBy).toBe("politician+category+window");
      expect(pair.confidence).toBe("POSSIBLE");
      expect(pair.score).toBe(0.45);
    }
  });

  it("does not pair drafts created more than 14 days apart", async () => {
    mockedAffairFindMany.mockResolvedValue([
      makeDraft("a1", { createdAt: new Date("2026-05-01T00:00:00Z") }),
      makeDraft("a2", { createdAt: new Date("2026-05-20T00:00:00Z") }),
    ]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(0);
  });

  it("does not pair drafts from incompatible category families", async () => {
    mockedAffairFindMany.mockResolvedValue([
      makeDraft("a1", { category: "MENACE" }),
      makeDraft("a2", { category: "FRAUDE_FISCALE" }),
    ]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(0);
  });

  it("ignores non-DRAFT affairs in the window pass", async () => {
    mockedAffairFindMany.mockResolvedValue([
      makeDraft("a1", { publicationStatus: "PUBLISHED" }),
      makeDraft("a2"),
    ]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(0);
  });

  it("does not pair drafts of different politicians", async () => {
    mockedAffairFindMany.mockResolvedValue([
      makeDraft("a1", { politicianId: "p1" }),
      makeDraft("a2", { politicianId: "p2" }),
    ]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(0);
  });

  it("respects dismissed pairs", async () => {
    mockedAffairFindMany.mockResolvedValue([makeDraft("a1"), makeDraft("a2")]);
    mockedDismissedFindMany.mockResolvedValue([{ affairIdA: "a1", affairIdB: "a2" }]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(0);
  });

  it("does not duplicate pairs already found by identifier matching", async () => {
    mockedAffairFindMany.mockResolvedValue([makeDraft("a1"), makeDraft("a2")]);
    mockedFindMatchingAffairs.mockResolvedValue([
      { affairId: "a1", confidence: "HIGH", score: 0.95, matchedBy: "pourvoiNumber" },
    ]);

    const duplicates = await findPotentialDuplicates();

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.matchedBy).toBe("pourvoiNumber");
  });
});
