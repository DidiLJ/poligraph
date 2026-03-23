import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

import { describe, it, expect } from "vitest";
import { mergeAndDedupe, type TopMoverItem } from "./top-movers";

const makeMover = (
  politicianId: string,
  type: TopMoverItem["type"],
  reason: string
): TopMoverItem => ({
  politician: {
    slug: politicianId,
    firstName: "Test",
    lastName: politicianId,
    photoUrl: null,
    currentParty: null,
  },
  reason,
  type,
  href: `/politiques/${politicianId}`,
});

describe("mergeAndDedupe", () => {
  it("returns up to 4 items", () => {
    const affairs = [
      makeMover("a", "affair", "Nouvelle affaire documentée"),
      makeMover("b", "affair", "Nouvelle affaire documentée"),
      makeMover("c", "affair", "Nouvelle affaire documentée"),
    ];
    const factchecks = [
      makeMover("d", "factcheck", "Fact-check récent : Faux"),
      makeMover("e", "factcheck", "Fact-check récent : Plutôt faux"),
    ];

    const result = mergeAndDedupe(affairs, factchecks);
    expect(result).toHaveLength(4);
  });

  it("deduplicates by politician slug", () => {
    const affairs = [makeMover("a", "affair", "Nouvelle affaire")];
    const factchecks = [makeMover("a", "factcheck", "Fact-check")];

    const result = mergeAndDedupe(affairs, factchecks);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("affair");
  });

  it("returns empty array when no data", () => {
    const result = mergeAndDedupe();
    expect(result).toHaveLength(0);
  });

  it("respects source priority order across all types", () => {
    const affairs = [makeMover("a", "affair", "Affaire")];
    const elections = [makeMover("b", "election", "Élu(e) à Paris")];
    const mandates = [makeMover("c", "mandate", "Nouveau mandat : Maire")];
    const factchecks = [makeMover("d", "factcheck", "Fact-check")];
    const parties = [makeMover("e", "party", "A rejoint LR")];

    const result = mergeAndDedupe(affairs, elections, mandates, factchecks, parties);
    expect(result.map((m) => m.type)).toEqual(["affair", "election", "mandate", "factcheck"]);
  });

  it("deduplicates across different source types", () => {
    const elections = [makeMover("a", "election", "Élu(e) à Lyon")];
    const mandates = [makeMover("a", "mandate", "Nouveau mandat : Maire de Lyon")];

    const result = mergeAndDedupe(elections, mandates);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("election");
  });
});
