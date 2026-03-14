import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { selectBestWikidataCandidate } from "./promote-maire";
import type { WikidataCandidate } from "./promote-maire";

describe("selectBestWikidataCandidate", () => {
  const candidate = (overrides: Partial<WikidataCandidate> = {}): WikidataCandidate => ({
    id: "Q100",
    label: "Test Politician",
    isFrench: true,
    isPolitician: true,
    birthDate: null,
    hasMairePosition: false,
    ...overrides,
  });

  it("returns null when no candidates", () => {
    expect(selectBestWikidataCandidate([], { birthDate: null })).toBeNull();
  });

  it("returns null when no French politicians", () => {
    const candidates = [candidate({ isFrench: false })];
    expect(selectBestWikidataCandidate(candidates, { birthDate: null })).toBeNull();
  });

  it("returns null when no politicians", () => {
    const candidates = [candidate({ isPolitician: false })];
    expect(selectBestWikidataCandidate(candidates, { birthDate: null })).toBeNull();
  });

  it("prefers candidate with MAIRE position", () => {
    const candidates = [
      candidate({ id: "Q1", hasMairePosition: false }),
      candidate({ id: "Q2", hasMairePosition: true }),
    ];
    expect(selectBestWikidataCandidate(candidates, { birthDate: null })?.id).toBe("Q2");
  });

  it("prefers candidate with matching birth date", () => {
    const ref = new Date("1960-06-15");
    const candidates = [
      candidate({ id: "Q1", birthDate: new Date("1955-01-01") }),
      candidate({ id: "Q2", birthDate: new Date("1960-06-14") }),
    ];
    expect(selectBestWikidataCandidate(candidates, { birthDate: ref })?.id).toBe("Q2");
  });

  it("birth date + MAIRE beats MAIRE alone", () => {
    const ref = new Date("1960-06-15");
    const candidates = [
      candidate({ id: "Q1", hasMairePosition: true, birthDate: null }),
      candidate({ id: "Q2", hasMairePosition: true, birthDate: new Date("1960-06-15") }),
    ];
    expect(selectBestWikidataCandidate(candidates, { birthDate: ref })?.id).toBe("Q2");
  });

  it("returns single valid candidate even without MAIRE or birthDate", () => {
    const candidates = [candidate({ id: "Q1" })];
    expect(selectBestWikidataCandidate(candidates, { birthDate: null })?.id).toBe("Q1");
  });

  it("rejects birth date outside 5-day tolerance", () => {
    const ref = new Date("1960-06-15");
    const candidates = [
      candidate({ id: "Q1", birthDate: new Date("1960-06-08") }),
      candidate({ id: "Q2", hasMairePosition: true }),
    ];
    const result = selectBestWikidataCandidate(candidates, { birthDate: ref });
    expect(result?.id).toBe("Q2");
  });

  it("filters out non-French among mixed candidates", () => {
    const candidates = [
      candidate({ id: "Q1", isFrench: false, hasMairePosition: true }),
      candidate({ id: "Q2", isFrench: true }),
    ];
    expect(selectBestWikidataCandidate(candidates, { birthDate: null })?.id).toBe("Q2");
  });

  it("ignores official birth date when no candidate has one", () => {
    const ref = new Date("1960-06-15");
    const candidates = [
      candidate({ id: "Q1", birthDate: null }),
      candidate({ id: "Q2", birthDate: null, hasMairePosition: true }),
    ];
    expect(selectBestWikidataCandidate(candidates, { birthDate: ref })?.id).toBe("Q2");
  });
});
