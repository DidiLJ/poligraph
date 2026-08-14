import { describe, it, expect } from "vitest";
import { buildGroupeSeo } from "@/lib/seo/groupe-metadata";

describe("buildGroupeSeo", () => {
  it("names the Assemblée nationale for an AN group", () => {
    const seo = buildGroupeSeo({
      name: "Groupe Les Démocrates",
      code: "DEM",
      chamber: "AN",
      seatCount: 36,
      hasStats: true,
    });
    expect(seo.title).toBe("Groupe Les Démocrates à l'Assemblée nationale : membres et votes");
    expect(seo.description).toBe(
      "Groupe Les Démocrates (DEM) à l'Assemblée nationale : 36 membres, votes parlementaires, cohésion du groupe."
    );
  });

  it("names the Sénat for a Senate group", () => {
    const seo = buildGroupeSeo({
      name: "Groupe Les Républicains",
      code: "LR",
      chamber: "SENAT",
      seatCount: 132,
      hasStats: true,
    });
    expect(seo.title).toBe("Groupe Les Républicains au Sénat : membres et votes");
    expect(seo.description).toContain("au Sénat : 132 membres");
    expect(seo.title).not.toContain("Assemblée nationale");
    expect(seo.description).not.toContain("Assemblée nationale");
  });

  it("never advertises participation, available or not (issue #717)", () => {
    for (const hasStats of [true, false]) {
      const seo = buildGroupeSeo({
        name: "Groupe X",
        code: "X",
        chamber: "SENAT",
        seatCount: 10,
        hasStats,
      });
      expect(seo.description.toLowerCase()).not.toContain("participation");
      expect(seo.title.toLowerCase()).not.toContain("participation");
    }
  });

  it("promises no statistic when no stats row exists", () => {
    const seo = buildGroupeSeo({
      name: "Groupe X",
      code: "X",
      chamber: "AN",
      seatCount: 10,
      hasStats: false,
    });
    expect(seo.description).toBe(
      "Groupe X (X) à l'Assemblée nationale : 10 membres, votes parlementaires."
    );
    expect(seo.description).not.toContain("cohésion");
  });

  it("omits the seat count rather than claiming zero members", () => {
    const seo = buildGroupeSeo({
      name: "Groupe X",
      code: "X",
      chamber: "AN",
      seatCount: 0,
      hasStats: false,
    });
    expect(seo.description).toBe("Groupe X (X) à l'Assemblée nationale : votes parlementaires.");
    expect(seo.description).not.toContain("0 membre");
  });

  it("agrees in number on a single-member group", () => {
    const seo = buildGroupeSeo({
      name: "Groupe X",
      code: "X",
      chamber: "AN",
      seatCount: 1,
      hasStats: false,
    });
    expect(seo.description).toContain("1 membre,");
  });
});
