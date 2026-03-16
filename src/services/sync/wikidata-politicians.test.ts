import { describe, it, expect } from "vitest";
import {
  determineIsCurrent,
  parseSparqlBindings,
  type SparqlPoliticianBinding,
} from "./wikidata-politicians-parsing";

describe("determineIsCurrent", () => {
  it("returns false when end date is present", () => {
    expect(determineIsCurrent("2020-01-01", "2024-06-30")).toBe(false);
  });

  it("returns true when no end date and start >= 2020", () => {
    expect(determineIsCurrent("2021-07-01", undefined)).toBe(true);
  });

  it("returns false when no end date and start < 2020", () => {
    expect(determineIsCurrent("2015-03-29", undefined)).toBe(false);
  });

  it("returns false when neither start nor end date", () => {
    expect(determineIsCurrent(undefined, undefined)).toBe(false);
  });

  it("returns true when no end date and start is 2020-01-01 exactly", () => {
    expect(determineIsCurrent("2020-01-01", undefined)).toBe(true);
  });
});

describe("parseSparqlBindings", () => {
  const bindings: SparqlPoliticianBinding[] = [
    {
      person: { value: "http://www.wikidata.org/entity/Q123" },
      personLabel: { value: "Jean Dupont" },
      position: { value: "http://www.wikidata.org/entity/Q19546" },
      startDate: { value: "2021-07-01T00:00:00Z" },
    },
    {
      person: { value: "http://www.wikidata.org/entity/Q123" },
      personLabel: { value: "Jean Dupont" },
      position: { value: "http://www.wikidata.org/entity/Q3044918" },
      startDate: { value: "2012-06-01T00:00:00Z" },
      endDate: { value: "2017-06-01T00:00:00Z" },
    },
    {
      person: { value: "http://www.wikidata.org/entity/Q456" },
      personLabel: { value: "Marie Martin" },
      position: { value: "http://www.wikidata.org/entity/Q1805817" },
      birthDate: { value: "1965-04-12T00:00:00Z" },
      gender: { value: "http://www.wikidata.org/entity/Q6581072" },
    },
  ];

  it("groups mandates by Q-ID", () => {
    const result = parseSparqlBindings(bindings);
    expect(result).toHaveLength(2);
  });

  it("extracts Q-ID from entity URL", () => {
    const result = parseSparqlBindings(bindings);
    expect(result[0]!.wikidataId).toBe("Q123");
  });

  it("splits label into firstName and lastName", () => {
    const result = parseSparqlBindings(bindings);
    expect(result[0]!.firstName).toBe("Jean");
    expect(result[0]!.lastName).toBe("Dupont");
  });

  it("collects multiple mandates for same person", () => {
    const result = parseSparqlBindings(bindings);
    const jean = result.find((p) => p.wikidataId === "Q123");
    expect(jean?.mandates).toHaveLength(2);
  });

  it("detects female gender from Q6581072", () => {
    const result = parseSparqlBindings(bindings);
    const marie = result.find((p) => p.wikidataId === "Q456");
    expect(marie?.civility).toBe("Mme");
  });

  it("parses birth date", () => {
    const result = parseSparqlBindings(bindings);
    const marie = result.find((p) => p.wikidataId === "Q456");
    expect(marie?.birthDate).toEqual(new Date("1965-04-12T00:00:00Z"));
  });
});
