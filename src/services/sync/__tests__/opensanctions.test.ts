import { describe, it, expect } from "vitest";
import { parseFtmPerson, toResolveInput } from "../opensanctions";

// Minimal FtM entity fixture matching real OpenSanctions NDJSON structure
const frenchDeputy = {
  id: "Q123456",
  caption: "Jean Dupont",
  schema: "Person",
  properties: {
    firstName: ["Jean"],
    lastName: ["Dupont"],
    birthDate: ["1965-03-15"],
    country: ["fr"],
    gender: ["male"],
    position: ["Member of the French National Assembly"],
  },
  datasets: ["fr_assemblee", "peps"],
  referents: ["fr-assemblee-PA123"],
  target: true,
  first_seen: "2024-01-01T00:00:00",
  last_seen: "2026-03-21T00:00:00",
  last_change: "2026-03-20T00:00:00",
};

const frenchCompany = {
  id: "OS-comp-1",
  caption: "Acme SAS",
  schema: "Company",
  properties: {
    name: ["Acme SAS"],
    country: ["fr"],
    jurisdiction: ["fr"],
  },
  datasets: ["fr_amf_regulatory_sanctions"],
  referents: [],
  target: true,
  first_seen: "2024-01-01T00:00:00",
  last_seen: "2026-03-21T00:00:00",
  last_change: "2026-03-20T00:00:00",
};

const partialBirthdate = {
  ...frenchDeputy,
  id: "Q789",
  properties: {
    ...frenchDeputy.properties,
    birthDate: ["1965"],
  },
};

describe("opensanctions FtM parser", () => {
  describe("parseFtmPerson", () => {
    it("parses a valid French person entity", () => {
      const result = parseFtmPerson(frenchDeputy);
      expect(result).not.toBeNull();
      expect(result!.firstName).toBe("Jean");
      expect(result!.lastName).toBe("Dupont");
      expect(result!.birthDate).toEqual(new Date("1965-03-15"));
      expect(result!.entityId).toBe("Q123456");
      expect(result!.datasets).toEqual(["fr_assemblee", "peps"]);
    });

    it("returns null for non-Person schema", () => {
      expect(parseFtmPerson(frenchCompany)).toBeNull();
    });

    it("returns null when firstName or lastName is missing", () => {
      const noName = {
        ...frenchDeputy,
        properties: { ...frenchDeputy.properties, firstName: [] },
      };
      expect(parseFtmPerson(noName)).toBeNull();
    });

    it("handles partial birthdate (year only)", () => {
      const result = parseFtmPerson(partialBirthdate);
      expect(result).not.toBeNull();
      expect(result!.birthDate).toEqual(new Date("1965-01-01"));
    });

    it("handles missing birthdate gracefully", () => {
      const noBirth = {
        ...frenchDeputy,
        properties: { ...frenchDeputy.properties, birthDate: [] },
      };
      const result = parseFtmPerson(noBirth);
      expect(result).not.toBeNull();
      expect(result!.birthDate).toBeNull();
    });
  });

  describe("toResolveInput", () => {
    it("maps parsed person to ResolveInput", () => {
      const parsed = parseFtmPerson(frenchDeputy)!;
      const input = toResolveInput(parsed);
      expect(input.firstName).toBe("Jean");
      expect(input.lastName).toBe("Dupont");
      expect(input.source).toBe("OPENSANCTIONS");
      expect(input.sourceId).toBe("Q123456");
      expect(input.birthDate).toEqual(new Date("1965-03-15"));
      expect(input.context).toEqual({
        datasets: ["fr_assemblee", "peps"],
      });
    });
  });
});
