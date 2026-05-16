import { describe, expect, it } from "vitest";
import {
  DONATION_PLATFORMS,
  EXPENSES,
  FEATURES_FUNDED,
  RESCRIT_STATUS,
  totalMonthlyEuros,
} from "./donation";

describe("donation config", () => {
  describe("DONATION_PLATFORMS", () => {
    it("contient HelloAsso comme plateforme primaire", () => {
      const primary = DONATION_PLATFORMS.filter((p) => p.primary);
      expect(primary).toHaveLength(1);
      expect(primary[0]!.name).toBe("HelloAsso");
    });

    it("contient Tipeee en plateforme secondaire", () => {
      const tipeee = DONATION_PLATFORMS.find((p) => p.name === "Tipeee");
      expect(tipeee).toBeDefined();
      expect(tipeee!.primary).toBe(false);
    });

    it("toutes les URLs utilisent HTTPS", () => {
      for (const platform of DONATION_PLATFORMS) {
        expect(platform.url.startsWith("https://")).toBe(true);
      }
    });

    it("toutes les URLs HelloAsso pointent vers helloasso.com/associations/association-sankofa", () => {
      const helloasso = DONATION_PLATFORMS.find((p) => p.name === "HelloAsso");
      expect(helloasso!.url).toMatch(
        /^https:\/\/www\.helloasso\.com\/associations\/association-sankofa(\/|$)/
      );
    });
  });

  describe("EXPENSES", () => {
    it("contient au moins les 4 postes de base", () => {
      expect(EXPENSES.length).toBeGreaterThanOrEqual(4);
    });

    it("chaque dépense expose un montant entier positif en euros", () => {
      for (const expense of EXPENSES) {
        expect(Number.isInteger(expense.monthlyEuros)).toBe(true);
        expect(expense.monthlyEuros).toBeGreaterThan(0);
      }
    });

    it("chaque dépense a un label et une description non vides", () => {
      for (const expense of EXPENSES) {
        expect(expense.label.length).toBeGreaterThan(0);
        expect(expense.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("totalMonthlyEuros", () => {
    it("retourne la somme entière des montants", () => {
      const expected = EXPENSES.reduce((sum, e) => sum + e.monthlyEuros, 0);
      expect(totalMonthlyEuros()).toBe(expected);
    });
  });

  describe("FEATURES_FUNDED", () => {
    it("contient au moins 5 promesses", () => {
      expect(FEATURES_FUNDED.length).toBeGreaterThanOrEqual(5);
    });

    it("aucune entrée vide", () => {
      for (const feature of FEATURES_FUNDED) {
        expect(feature.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe("RESCRIT_STATUS", () => {
    it("est l'une des trois valeurs autorisées", () => {
      expect(["pending", "in_review", "validated"]).toContain(RESCRIT_STATUS);
    });
  });
});
