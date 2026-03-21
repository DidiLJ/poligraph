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
    const affairs = [makeMover("a", "affair", "Nouvelle affaire documentée")];
    const factchecks = [makeMover("b", "factcheck", "Fact-check récent : Faux")];
    const participation = [
      makeMover("c", "participation", "Taux de participation : 12%"),
      makeMover("d", "participation", "Taux de participation : 15%"),
      makeMover("e", "participation", "Taux de participation : 18%"),
    ];

    const result = mergeAndDedupe(affairs, factchecks, participation);
    expect(result).toHaveLength(4);
  });

  it("deduplicates by politician slug", () => {
    const affairs = [makeMover("a", "affair", "Nouvelle affaire")];
    const factchecks = [makeMover("a", "factcheck", "Fact-check")];
    const participation = [makeMover("b", "participation", "Participation")];

    const result = mergeAndDedupe(affairs, factchecks, participation);
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe("affair");
  });

  it("returns empty array when no data", () => {
    const result = mergeAndDedupe([], [], []);
    expect(result).toHaveLength(0);
  });

  it("prioritizes affairs over factchecks over participation", () => {
    const affairs = [makeMover("a", "affair", "Affaire")];
    const factchecks = [makeMover("b", "factcheck", "Fact-check")];
    const participation = [makeMover("c", "participation", "Participation")];

    const result = mergeAndDedupe(affairs, factchecks, participation);
    expect(result.map((m) => m.type)).toEqual(["affair", "factcheck", "participation"]);
  });
});
