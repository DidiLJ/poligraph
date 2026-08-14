import { describe, it, expect } from "vitest";
import {
  resolveParliamentaryChamber,
  buildPoliticianVotesSeo,
  buildPoliticianVotesIntro,
} from "@/lib/seo/politician-votes-metadata";

describe("resolveParliamentaryChamber", () => {
  it("resolves a sitting deputy to the Assemblée nationale", () => {
    expect(resolveParliamentaryChamber([{ type: "DEPUTE", isCurrent: true }])).toBe("AN");
  });

  it("resolves a sitting senator to the Sénat", () => {
    expect(resolveParliamentaryChamber([{ type: "SENATEUR", isCurrent: true }])).toBe("SENAT");
  });

  it("ignores non-parliamentary mandates", () => {
    expect(
      resolveParliamentaryChamber([
        { type: "MAIRE", isCurrent: true },
        { type: "SENATEUR", isCurrent: true },
      ])
    ).toBe("SENAT");
    expect(
      resolveParliamentaryChamber([
        { type: "MAIRE", isCurrent: true },
        { type: "MINISTRE", isCurrent: true },
      ])
    ).toBeNull();
  });

  it("returns null when no parliamentary mandate is recorded", () => {
    expect(resolveParliamentaryChamber([])).toBeNull();
  });

  it("returns null rather than picking one when two current chambers appear", () => {
    // Legally impossible: this is a data defect, and a defect must not become
    // an assertion about where the person sits.
    expect(
      resolveParliamentaryChamber([
        { type: "DEPUTE", isCurrent: true },
        { type: "SENATEUR", isCurrent: true },
      ])
    ).toBeNull();
  });

  it("falls back to past mandates only when they agree", () => {
    expect(resolveParliamentaryChamber([{ type: "DEPUTE", isCurrent: false }])).toBe("AN");
    expect(
      resolveParliamentaryChamber([
        { type: "DEPUTE", isCurrent: false },
        { type: "SENATEUR", isCurrent: false },
      ])
    ).toBeNull();
  });

  it("prefers the current mandate over a past one in the other chamber", () => {
    expect(
      resolveParliamentaryChamber([
        { type: "DEPUTE", isCurrent: false },
        { type: "SENATEUR", isCurrent: true },
      ])
    ).toBe("SENAT");
  });
});

describe("buildPoliticianVotesSeo", () => {
  it("targets the Assemblée nationale for a deputy", () => {
    const seo = buildPoliticianVotesSeo("Jean Dupont", "AN");
    expect(seo.title).toBe("Votes de Jean Dupont à l'Assemblée nationale");
    expect(seo.description).toBe(
      "Consultez les votes parlementaires de Jean Dupont à l'Assemblée nationale : textes de loi, amendements et positions enregistrées."
    );
    expect(seo.heading).toBe("Votes de Jean Dupont à l'Assemblée nationale");
  });

  it("targets the Sénat for a senator and never says Assemblée nationale", () => {
    const seo = buildPoliticianVotesSeo("Marie Martin", "SENAT");
    expect(seo.title).toBe("Votes de Marie Martin au Sénat");
    expect(seo.description).toBe(
      "Consultez les votes parlementaires de Marie Martin au Sénat : textes de loi, amendements et positions enregistrées."
    );
    expect(seo.heading).toBe("Votes de Marie Martin au Sénat");
    expect(seo.title).not.toContain("Assemblée nationale");
    expect(seo.description).not.toContain("Assemblée nationale");
  });

  it("falls back to a chamber-free wording when the chamber is unknown", () => {
    const seo = buildPoliticianVotesSeo("Camille Durand", null);
    expect(seo.title).toBe("Votes parlementaires de Camille Durand");
    expect(seo.description).toBe(
      "Consultez les votes parlementaires enregistrés pour Camille Durand : textes de loi, amendements et positions enregistrées."
    );
    expect(seo.heading).toBe("Votes de Camille Durand");
    for (const value of [seo.title, seo.description, seo.heading]) {
      expect(value).not.toContain("Assemblée nationale");
      expect(value).not.toContain("Sénat");
    }
  });
});

describe("buildPoliticianVotesIntro", () => {
  it("states the recorded volume and the chamber", () => {
    expect(
      buildPoliticianVotesIntro({
        fullName: "Jean Dupont",
        chamber: "AN",
        totalVotes: 204,
        amendmentVotes: 112,
      })
    ).toBe(
      "204 votes de Jean Dupont sont enregistrés à l'Assemblée nationale. 112 portent sur des amendements."
    );
  });

  it("omits the chamber when it is unknown", () => {
    const intro = buildPoliticianVotesIntro({
      fullName: "Camille Durand",
      chamber: null,
      totalVotes: 3,
      amendmentVotes: 0,
    });
    expect(intro).toBe("3 votes de Camille Durand sont enregistrés.");
    expect(intro).not.toContain("Assemblée nationale");
    expect(intro).not.toContain("Sénat");
  });

  it("returns null when nothing is recorded, rather than writing a zero", () => {
    expect(
      buildPoliticianVotesIntro({
        fullName: "Camille Durand",
        chamber: "AN",
        totalVotes: 0,
        amendmentVotes: 0,
      })
    ).toBeNull();
  });

  it("carries no participation claim (issue #717)", () => {
    const intro = buildPoliticianVotesIntro({
      fullName: "Jean Dupont",
      chamber: "AN",
      totalVotes: 100,
      amendmentVotes: 20,
    });
    expect(intro?.toLowerCase()).not.toContain("participation");
    expect(intro).not.toContain("%");
  });
});
