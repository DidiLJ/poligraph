import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { findExistingMatch, deduplicateIntraBatch } from "./bulk-create-maires";

describe("findExistingMatch", () => {
  const existing = new Map([
    ["jean-dupont|1960-06-15", "pol-id-1"],
    ["marie-martin|1975-03-20", "pol-id-2"],
  ]);

  it("finds exact match by normalized name + birthDate", () => {
    const result = findExistingMatch(
      { fullName: "Jean Dupont", birthDate: new Date("1960-06-15") },
      existing
    );
    expect(result).toBe("pol-id-1");
  });

  it("returns null when no match", () => {
    const result = findExistingMatch(
      { fullName: "Pierre Martin", birthDate: new Date("1980-01-01") },
      existing
    );
    expect(result).toBeNull();
  });

  it("normalizes accents and case", () => {
    const result = findExistingMatch(
      { fullName: "JEAN DUPONT", birthDate: new Date("1960-06-15") },
      existing
    );
    expect(result).toBe("pol-id-1");
  });

  it("handles accented names", () => {
    const map = new Map([["rene-levy|1950-01-01", "pol-id-3"]]);
    const result = findExistingMatch(
      { fullName: "René Lévy", birthDate: new Date("1950-01-01") },
      map
    );
    expect(result).toBe("pol-id-3");
  });
});

describe("deduplicateIntraBatch", () => {
  it("returns unique entries by normalized name + birthDate", () => {
    const batch = [
      { id: "lo-1", fullName: "Jean Dupont", birthDate: new Date("1960-06-15") },
      { id: "lo-2", fullName: "Jean Dupont", birthDate: new Date("1960-06-15") },
      { id: "lo-3", fullName: "Marie Martin", birthDate: new Date("1975-03-20") },
    ];
    const { unique, duplicateIds } = deduplicateIntraBatch(batch);
    expect(unique).toHaveLength(2);
    expect(unique.map((u) => u.id)).toEqual(["lo-1", "lo-3"]);
    expect(duplicateIds).toEqual(["lo-2"]);
  });

  it("keeps first occurrence when names differ only in case/accents", () => {
    const batch = [
      { id: "lo-1", fullName: "René Lévy", birthDate: new Date("1950-01-01") },
      { id: "lo-2", fullName: "RENE LEVY", birthDate: new Date("1950-01-01") },
    ];
    const { unique, duplicateIds } = deduplicateIntraBatch(batch);
    expect(unique).toHaveLength(1);
    expect(unique[0]!.id).toBe("lo-1");
    expect(duplicateIds).toEqual(["lo-2"]);
  });

  it("treats same name with different birthDate as distinct", () => {
    const batch = [
      { id: "lo-1", fullName: "Jean Dupont", birthDate: new Date("1960-06-15") },
      { id: "lo-2", fullName: "Jean Dupont", birthDate: new Date("1985-11-30") },
    ];
    const { unique } = deduplicateIntraBatch(batch);
    expect(unique).toHaveLength(2);
  });
});
