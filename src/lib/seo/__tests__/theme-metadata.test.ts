import { describe, it, expect } from "vitest";
import {
  THEME_SEO_PHRASES,
  buildThemeTitle,
  buildThemeDescription,
  buildThemeH1,
  buildThemeIntro,
} from "@/lib/seo/theme-metadata";
import { getAllThemeSlugs, themeFromSlug } from "@/lib/theme-utils";

const BOTH = { hasAN: true, hasSenat: true } as const;
const AN_ONLY = { hasAN: true, hasSenat: false } as const;
const SENAT_ONLY = { hasAN: false, hasSenat: true } as const;
const NONE = { hasAN: false, hasSenat: false } as const;

describe("theme SEO phrases", () => {
  it("covers every routable theme", () => {
    for (const slug of getAllThemeSlugs()) {
      const theme = themeFromSlug(slug);
      expect(theme).not.toBeNull();
      expect(THEME_SEO_PHRASES[theme!]).toBeTruthy();
    }
  });

  it("is a prepositional form, never the bare display label", () => {
    // "Votes sur Économie" is what this config exists to prevent: no phrase may
    // start with a capital letter (i.e. be a raw label injected in a sentence).
    for (const phrase of Object.values(THEME_SEO_PHRASES)) {
      expect(phrase).toBe(phrase.toLocaleLowerCase("fr-FR"));
    }
  });
});

describe("buildThemeTitle", () => {
  it("names both chambers when both are covered", () => {
    expect(buildThemeTitle("SANTE", BOTH)).toBe(
      "Votes sur la santé à l'Assemblée nationale et au Sénat"
    );
  });

  it("keeps the grammar correct on elided themes", () => {
    expect(buildThemeTitle("ECONOMIE_BUDGET", BOTH)).toBe(
      "Votes sur l'économie et le budget à l'Assemblée nationale et au Sénat"
    );
    expect(buildThemeTitle("IMMIGRATION", BOTH)).toBe(
      "Votes sur l'immigration à l'Assemblée nationale et au Sénat"
    );
    expect(buildThemeTitle("ENVIRONNEMENT_ENERGIE", BOTH)).toBe(
      "Votes sur l'environnement et l'énergie à l'Assemblée nationale et au Sénat"
    );
  });

  it("does not claim a chamber the theme does not cover", () => {
    expect(buildThemeTitle("SANTE", AN_ONLY)).toBe("Votes sur la santé à l'Assemblée nationale");
    expect(buildThemeTitle("SANTE", SENAT_ONLY)).toBe("Votes sur la santé au Sénat");
    expect(buildThemeTitle("SANTE", NONE)).toBe("Votes parlementaires sur la santé");
    expect(buildThemeTitle("SANTE", AN_ONLY)).not.toContain("Sénat");
  });
});

describe("buildThemeDescription", () => {
  it("follows the target wording when both chambers are covered", () => {
    expect(buildThemeDescription("SANTE", BOTH)).toBe(
      "Consultez les votes du Parlement sur la santé : scrutins de l'Assemblée nationale et du Sénat, résultats, textes de loi et amendements."
    );
  });

  it("drops the Senate when it is not covered", () => {
    const description = buildThemeDescription("IMMIGRATION", AN_ONLY);
    expect(description).toContain("scrutins de l'Assemblée nationale,");
    expect(description).not.toContain("Sénat");
  });
});

describe("buildThemeH1", () => {
  it("is explicit rather than the bare label", () => {
    expect(buildThemeH1("SANTE")).toBe("Votes parlementaires sur la santé");
    expect(buildThemeH1("ECONOMIE_BUDGET")).toBe(
      "Votes parlementaires sur l'économie et le budget"
    );
  });
});

describe("buildThemeIntro", () => {
  it("states deterministic counts and the covered chambers", () => {
    expect(
      buildThemeIntro({
        theme: "SANTE",
        total: 142,
        adoptedPercent: 58,
        lastVoteDateLabel: "12 mars 2026",
        coverage: BOTH,
      })
    ).toBe(
      "142 scrutins parlementaires sur la santé sont référencés, dont 58 % adoptés. Dernier scrutin : 12 mars 2026. Retrouvez les votes de l'Assemblée nationale et du Sénat, les textes de loi et les amendements concernés."
    );
  });

  it("agrees in number and omits an unknown last vote date", () => {
    expect(
      buildThemeIntro({
        theme: "TRANSPORTS",
        total: 1,
        adoptedPercent: 100,
        lastVoteDateLabel: null,
        coverage: AN_ONLY,
      })
    ).toBe(
      "1 scrutin parlementaire sur les transports est référencé, dont 100 % adoptés. Retrouvez les votes de l'Assemblée nationale, les textes de loi et les amendements concernés."
    );
  });

  it("never mentions the Senate on an AN-only theme", () => {
    const intro = buildThemeIntro({
      theme: "IMMIGRATION",
      total: 12,
      adoptedPercent: 25,
      lastVoteDateLabel: "3 février 2026",
      coverage: AN_ONLY,
    });
    expect(intro).not.toContain("Sénat");
  });

  it("does not invent content when the theme is empty", () => {
    expect(
      buildThemeIntro({
        theme: "SANTE",
        total: 0,
        adoptedPercent: 0,
        lastVoteDateLabel: null,
        coverage: NONE,
      })
    ).toBe("Aucun scrutin sur la santé n'est référencé à ce jour.");
  });

  it("is not a repetition of the title", () => {
    const intro = buildThemeIntro({
      theme: "SANTE",
      total: 42,
      adoptedPercent: 50,
      lastVoteDateLabel: "1 janvier 2026",
      coverage: BOTH,
    });
    expect(intro).not.toContain(buildThemeTitle("SANTE", BOTH));
  });

  it("carries no participation claim (issue #717)", () => {
    const intro = buildThemeIntro({
      theme: "SANTE",
      total: 42,
      adoptedPercent: 50,
      lastVoteDateLabel: "1 janvier 2026",
      coverage: BOTH,
    });
    expect(intro.toLowerCase()).not.toContain("participation");
  });
});
