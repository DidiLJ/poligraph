import { describe, it, expect } from "vitest";
import { FrenchNormalizer } from "../adapters/fr/normalizer";

const normalizer = new FrenchNormalizer();

describe("FrenchNormalizer", () => {
  describe("normalizeLastName", () => {
    it("lowercases and removes accents", () => {
      expect(normalizer.normalizeLastName("Mélenchon")).toBe("melenchon");
    });

    it("lowercases multi-word names", () => {
      expect(normalizer.normalizeLastName("Le Pen")).toBe("le pen");
    });

    it("converts hyphens to spaces", () => {
      expect(normalizer.normalizeLastName("Braun-Pivet")).toBe("braun pivet");
    });

    it("handles compound names with accents", () => {
      expect(normalizer.normalizeLastName("Libert Albanel")).toBe("libert albanel");
    });

    it("is idempotent", () => {
      const once = normalizer.normalizeLastName("François-Marie");
      const twice = normalizer.normalizeLastName(once);
      expect(once).toBe(twice);
    });

    it("handles curly apostrophes", () => {
      expect(normalizer.normalizeLastName("D\u2019Ornano")).toBe("d'ornano");
    });
  });

  describe("normalizeFirstName", () => {
    it("converts hyphens to spaces", () => {
      expect(normalizer.normalizeFirstName("Jean-Pierre")).toBe("jean pierre");
    });

    it("lowercases and removes accents", () => {
      expect(normalizer.normalizeFirstName("Hélène")).toBe("helene");
    });
  });

  describe("normalizeFull", () => {
    it("returns normalized string and tokens", () => {
      const result = normalizer.normalizeFull("Jean-Pierre Mélenchon");
      expect(result.normalized).toBe("jean pierre melenchon");
      expect(result.tokens).toEqual(["jean", "pierre", "melenchon"]);
      expect(result.original).toBe("Jean-Pierre Mélenchon");
    });
  });

  describe("tokenize", () => {
    it("splits on spaces and hyphens, strips particles", () => {
      expect(normalizer.tokenize("Jean-Pierre de La Fontaine")).toEqual([
        "jean",
        "pierre",
        "fontaine",
      ]);
    });

    it("preserves non-particle short words", () => {
      expect(normalizer.tokenize("Le Pen")).toEqual(["le", "pen"]);
    });
  });

  describe("primarySurname", () => {
    it("extracts first component of compound surname", () => {
      expect(normalizer.primarySurname("libert albanel")).toBe("libert");
    });

    it("returns null for single-word names", () => {
      expect(normalizer.primarySurname("melenchon")).toBeNull();
    });

    it("returns null when first word is a short particle", () => {
      expect(normalizer.primarySurname("de la fontaine")).toBeNull();
    });
  });
});
