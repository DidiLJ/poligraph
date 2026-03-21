import { describe, it, expect } from "vitest";

describe("chamber adoption rate calculation", () => {
  function calculateRates(results: Array<{ chamber: string; result: string; _count: number }>) {
    const byC = new Map<string, { total: number; adopted: number }>();
    for (const r of results) {
      const entry = byC.get(r.chamber) ?? { total: 0, adopted: 0 };
      entry.total += r._count;
      if (r.result === "ADOPTED") entry.adopted += r._count;
      byC.set(r.chamber, entry);
    }
    return Array.from(byC.entries()).map(([chamber, { total, adopted }]) => ({
      chamber,
      total,
      adopted,
      adoptionRate: total > 0 ? Math.round((adopted / total) * 100) : 0,
    }));
  }

  it("calculates adoption rate for both chambers", () => {
    const results = [
      { chamber: "AN", result: "ADOPTED", _count: 80 },
      { chamber: "AN", result: "REJECTED", _count: 20 },
      { chamber: "SENAT", result: "ADOPTED", _count: 60 },
      { chamber: "SENAT", result: "REJECTED", _count: 40 },
    ];
    const rates = calculateRates(results);
    const an = rates.find((r) => r.chamber === "AN")!;
    const senat = rates.find((r) => r.chamber === "SENAT")!;

    expect(an.total).toBe(100);
    expect(an.adopted).toBe(80);
    expect(an.adoptionRate).toBe(80);
    expect(senat.total).toBe(100);
    expect(senat.adopted).toBe(60);
    expect(senat.adoptionRate).toBe(60);
  });

  it("handles single chamber", () => {
    const results = [{ chamber: "AN", result: "ADOPTED", _count: 50 }];
    const rates = calculateRates(results);
    expect(rates).toHaveLength(1);
    expect(rates[0]!.adoptionRate).toBe(100);
  });

  it("handles empty results", () => {
    const rates = calculateRates([]);
    expect(rates).toHaveLength(0);
  });

  it("rounds adoption rate", () => {
    const results = [
      { chamber: "AN", result: "ADOPTED", _count: 2 },
      { chamber: "AN", result: "REJECTED", _count: 1 },
    ];
    const rates = calculateRates(results);
    expect(rates[0]!.adoptionRate).toBe(67);
  });
});
