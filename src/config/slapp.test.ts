import { describe, expect, it } from "vitest";
import {
  SLAPP_CRITERIA,
  type SlappCriteriaPayload,
  type QualificationRule,
  SLAPP_DIRECTIVE_EU,
} from "./slapp";

describe("slapp config", () => {
  describe("SLAPP_CRITERIA", () => {
    it("contient exactement les 5 critères de la spec", () => {
      expect(SLAPP_CRITERIA).toHaveLength(5);
      expect(SLAPP_CRITERIA.map((c) => c.id)).toEqual([
        "asymmetry",
        "publicInterest",
        "disproportion",
        "outcomeUnfavorable",
        "externalQualification",
      ]);
    });

    it("chaque critère a un label français et une description", () => {
      for (const criterion of SLAPP_CRITERIA) {
        expect(criterion.label.length).toBeGreaterThan(0);
        expect(criterion.description.length).toBeGreaterThan(0);
      }
    });

    it("seul le critère 5 expose le flag isExternalQualifier", () => {
      const externalOnly = SLAPP_CRITERIA.filter((c) => c.isExternalQualifier);
      expect(externalOnly).toHaveLength(1);
      expect(externalOnly[0]!.id).toBe("externalQualification");
    });
  });

  describe("SLAPP_DIRECTIVE_EU", () => {
    it("référence la directive UE 2024/1069", () => {
      expect(SLAPP_DIRECTIVE_EU.identifier).toBe("2024/1069");
      expect(SLAPP_DIRECTIVE_EU.url).toMatch(/^https:\/\/eur-lex\.europa\.eu\//);
    });
  });

  describe("SlappCriteriaPayload type contract", () => {
    it("accepte un payload valide avec critères verifiés et sources", () => {
      const payload: SlappCriteriaPayload = {
        asymmetry: { met: true, note: "Plaignant: élu, défendeur: journaliste" },
        publicInterest: { met: true, note: "Critique politique" },
        disproportion: { met: true, note: "100k€ demandés vs 1k€ préjudice" },
        outcomeUnfavorable: { met: false, note: "En cours" },
        externalQualification: {
          met: true,
          source: "https://rsf.org/fr/case-x",
          qualifierName: "RSF",
        },
        qualificationRule: "3of5",
      };
      expect(payload.qualificationRule).toBe("3of5");
    });
  });

  describe("QualificationRule type", () => {
    it("accepte les deux valeurs autorisées", () => {
      const a: QualificationRule = "3of5";
      const b: QualificationRule = "criterion5_only";
      expect([a, b]).toContain("3of5");
    });
  });
});
