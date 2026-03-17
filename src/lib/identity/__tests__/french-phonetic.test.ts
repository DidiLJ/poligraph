import { describe, it, expect } from "vitest";
import { FrenchPhoneticEncoder } from "../adapters/fr/phonetic";

const encoder = new FrenchPhoneticEncoder();

describe("FrenchPhoneticEncoder", () => {
  describe("encode", () => {
    it("returns a non-empty array for valid input", () => {
      expect(encoder.encode("dupont").length).toBeGreaterThan(0);
    });

    it("returns an empty array for empty input", () => {
      expect(encoder.encode("")).toEqual([]);
      expect(encoder.encode("   ")).toEqual([]);
    });

    it("is consistent — same input always yields same output", () => {
      expect(encoder.encode("dupont")).toEqual(encoder.encode("dupont"));
    });

    describe("silent final consonant (CaReFuL rule)", () => {
      it("dupont and dupond produce the same code (silent d)", () => {
        expect(encoder.encode("dupont")).toEqual(encoder.encode("dupond"));
      });
    });

    describe("b/v ambiguity", () => {
      it("lefebvre and lefevre share at least one code", () => {
        const codes1 = new Set(encoder.encode("lefebvre"));
        const codes2 = encoder.encode("lefevre");
        expect(codes2.some((c) => codes1.has(c))).toBe(true);
      });

      it("encode returns two codes when b/v ambiguity exists", () => {
        expect(encoder.encode("lefebvre").length).toBe(2);
      });
    });

    describe("nasal vowels", () => {
      it("dupont and dupon produce the same code (on -> O nasal)", () => {
        expect(encoder.encode("dupont")).toEqual(encoder.encode("dupon"));
      });
    });

    describe("digraph substitutions", () => {
      it("charrier starts with S (ch -> S)", () => {
        expect(encoder.encode("charrier")[0]).toMatch(/^S/);
      });

      it("philippe starts with F (ph -> F)", () => {
        expect(encoder.encode("philippe")[0]).toMatch(/^F/);
      });
    });

    describe("silent h", () => {
      it("hervieu and ervieu produce the same codes", () => {
        expect(encoder.encode("hervieu")).toEqual(encoder.encode("ervieu"));
      });
    });

    describe("accent stripping", () => {
      it("herve and hervé produce the same codes", () => {
        expect(encoder.encode("herve")).toEqual(encoder.encode("hervé"));
      });

      it("lefevre and lefèvre produce the same codes", () => {
        expect(encoder.encode("lefevre")).toEqual(encoder.encode("lefèvre"));
      });
    });
  });

  describe("similarity", () => {
    it("returns 1.0 for identical names", () => {
      expect(encoder.similarity("dupont", "dupont")).toBe(1.0);
    });

    it("returns 1.0 for phonetically identical names (dupont / dupond)", () => {
      expect(encoder.similarity("dupont", "dupond")).toBe(1.0);
    });

    it("returns 1.0 for lefebvre and lefevre (b/v ambiguity)", () => {
      expect(encoder.similarity("lefebvre", "lefevre")).toBe(1.0);
    });

    it("returns 0.0 for clearly different names (martin / dupont)", () => {
      expect(encoder.similarity("martin", "dupont")).toBe(0.0);
    });
  });
});
