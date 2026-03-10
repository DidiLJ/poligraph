import { describe, it, expect, vi } from "vitest";

// Mock database to avoid DATABASE_URL requirement
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  detectNameQuality,
  scoreJudilibreMatch,
  determineContextSignal,
  JUDILIBRE_THRESHOLDS,
} from "./judilibre-scoring";

// ============================================
// detectNameQuality
// ============================================

describe("detectNameQuality", () => {
  it("returns STRONG when full name appears with word boundaries", () => {
    const text = "Le tribunal a condamné Nicolas Sarkozy pour corruption.";
    expect(detectNameQuality(text, "Nicolas Sarkozy")).toBe("STRONG");
  });

  it("returns STRONG when legal title M. precedes lastName", () => {
    const text = "M. Sarkozy a comparu devant le tribunal.";
    expect(detectNameQuality(text, "Nicolas Sarkozy")).toBe("STRONG");
  });

  it("returns STRONG when legal title Mme precedes lastName", () => {
    const text = "Mme Le Pen a fait appel de la décision.";
    expect(detectNameQuality(text, "Marine Le Pen")).toBe("STRONG");
  });

  it("returns STRONG for Prévenu + lastName", () => {
    const text = "le prévenu Balkany a été reconnu coupable.";
    expect(detectNameQuality(text, "Patrick Balkany")).toBe("STRONG");
  });

  it("returns STRONG for Prévenue (feminine) + lastName", () => {
    const text = "la prévenue Balkany a été reconnue coupable.";
    expect(detectNameQuality(text, "Isabelle Balkany")).toBe("STRONG");
  });

  it("returns STRONG for Condamné + lastName", () => {
    const text = "le condamné Fillon devra payer une amende.";
    expect(detectNameQuality(text, "François Fillon")).toBe("STRONG");
  });

  it("returns STRONG for Demandeur + lastName", () => {
    const text = "le demandeur Guéant a formé un pourvoi.";
    expect(detectNameQuality(text, "Claude Guéant")).toBe("STRONG");
  });

  it("returns STRONG for Défenderesse + lastName", () => {
    const text = "la défenderesse Lagarde conteste les accusations.";
    expect(detectNameQuality(text, "Christine Lagarde")).toBe("STRONG");
  });

  it("returns MODERATE when firstName and lastName are within proximity", () => {
    const text = "L'accusé, prénommé Patrick, a été entendu. Son nom est Balkany.";
    expect(detectNameQuality(text, "Patrick Balkany")).toBe("MODERATE");
  });

  it("returns null when firstName and lastName are too far apart", () => {
    const prefix = "L'accusé Patrick a été entendu. ";
    const filler = "x".repeat(200);
    const suffix = " Le nom Balkany apparaît plus loin.";
    const text = prefix + filler + suffix;
    expect(detectNameQuality(text, "Patrick Balkany")).toBeNull();
  });

  it("returns null when only lastName is found (no firstName)", () => {
    const text = "Le tribunal a jugé l'affaire Sarkozy.";
    expect(detectNameQuality(text, "Nicolas Sarkozy")).toBeNull();
  });

  it("returns null when lastName is too short", () => {
    const text = "François Ho a été convoqué.";
    expect(detectNameQuality(text, "François Ho")).toBeNull();
  });

  it("returns null when name is not found at all", () => {
    const text = "Le tribunal a rendu sa décision concernant les faits.";
    expect(detectNameQuality(text, "Nicolas Sarkozy")).toBeNull();
  });

  it("handles accented names correctly", () => {
    const text = "Le tribunal a entendu François Léotard dans cette affaire.";
    expect(detectNameQuality(text, "François Léotard")).toBe("STRONG");
  });

  it("handles compound lastNames (Le Pen)", () => {
    const text = "Marine Le Pen a été entendue par le tribunal.";
    expect(detectNameQuality(text, "Marine Le Pen")).toBe("STRONG");
  });

  it("does not match when name is embedded in another word", () => {
    const text = "Le document mentionne la mesure adoptée.";
    expect(detectNameQuality(text, "Jean Mesure")).toBeNull();
  });

  it("returns null when fullName has no lastName part (single word)", () => {
    expect(detectNameQuality("some text", "Madonna")).toBeNull();
  });
});

// ============================================
// scoreJudilibreMatch
// ============================================

describe("scoreJudilibreMatch", () => {
  describe("STRONG name quality", () => {
    it("STRONG + CERTAIN = 100, SAME, EXTERNAL_ID", () => {
      const result = scoreJudilibreMatch("STRONG", "CERTAIN");
      expect(result.score).toBe(100);
      expect(result.judgement).toBe("SAME");
      expect(result.method).toBe("EXTERNAL_ID");
    });

    it("STRONG + POSITIVE = 85, SAME, DEPARTMENT", () => {
      const result = scoreJudilibreMatch("STRONG", "POSITIVE");
      expect(result.score).toBe(85);
      expect(result.judgement).toBe("SAME");
      expect(result.method).toBe("DEPARTMENT");
    });

    it("STRONG + NEUTRAL = 70, UNDECIDED, NAME_ONLY", () => {
      const result = scoreJudilibreMatch("STRONG", "NEUTRAL");
      expect(result.score).toBe(70);
      expect(result.judgement).toBe("UNDECIDED");
      expect(result.method).toBe("NAME_ONLY");
    });

    it("STRONG + NEGATIVE = 50, UNDECIDED, NAME_ONLY", () => {
      const result = scoreJudilibreMatch("STRONG", "NEGATIVE");
      expect(result.score).toBe(50);
      expect(result.judgement).toBe("UNDECIDED");
      expect(result.method).toBe("NAME_ONLY");
    });
  });

  describe("MODERATE name quality", () => {
    it("MODERATE + CERTAIN = 100, SAME, EXTERNAL_ID", () => {
      const result = scoreJudilibreMatch("MODERATE", "CERTAIN");
      expect(result.score).toBe(100);
      expect(result.judgement).toBe("SAME");
      expect(result.method).toBe("EXTERNAL_ID");
    });

    it("MODERATE + POSITIVE = 70, UNDECIDED, DEPARTMENT", () => {
      const result = scoreJudilibreMatch("MODERATE", "POSITIVE");
      expect(result.score).toBe(70);
      expect(result.judgement).toBe("UNDECIDED");
      expect(result.method).toBe("DEPARTMENT");
    });

    it("MODERATE + NEUTRAL = 0, null judgement, NAME_ONLY", () => {
      const result = scoreJudilibreMatch("MODERATE", "NEUTRAL");
      expect(result.score).toBe(0);
      expect(result.judgement).toBeNull();
      expect(result.method).toBe("NAME_ONLY");
    });

    it("MODERATE + NEGATIVE = 0, null judgement, NAME_ONLY", () => {
      const result = scoreJudilibreMatch("MODERATE", "NEGATIVE");
      expect(result.score).toBe(0);
      expect(result.judgement).toBeNull();
      expect(result.method).toBe("NAME_ONLY");
    });
  });

  describe("null name quality (skip)", () => {
    it("null + any signal = 0, null judgement, NAME_ONLY", () => {
      const result = scoreJudilibreMatch(null, "CERTAIN");
      expect(result.score).toBe(0);
      expect(result.judgement).toBeNull();
      expect(result.nameQuality).toBeNull();
      expect(result.method).toBe("NAME_ONLY");
    });
  });

  describe("threshold boundaries", () => {
    it("score at SAME threshold (80) yields SAME", () => {
      // STRONG + POSITIVE = 85 >= 80
      const result = scoreJudilibreMatch("STRONG", "POSITIVE");
      expect(result.score).toBeGreaterThanOrEqual(JUDILIBRE_THRESHOLDS.SAME);
      expect(result.judgement).toBe("SAME");
    });

    it("score at UNDECIDED threshold (50) yields UNDECIDED", () => {
      // STRONG + NEGATIVE = 50 >= 50
      const result = scoreJudilibreMatch("STRONG", "NEGATIVE");
      expect(result.score).toBeGreaterThanOrEqual(JUDILIBRE_THRESHOLDS.UNDECIDED);
      expect(result.score).toBeLessThan(JUDILIBRE_THRESHOLDS.SAME);
      expect(result.judgement).toBe("UNDECIDED");
    });

    it("score below UNDECIDED threshold yields null", () => {
      // MODERATE + NEUTRAL = 0 < 50
      const result = scoreJudilibreMatch("MODERATE", "NEUTRAL");
      expect(result.score).toBeLessThan(JUDILIBRE_THRESHOLDS.UNDECIDED);
      expect(result.judgement).toBeNull();
    });
  });
});

// ============================================
// determineContextSignal
// ============================================

describe("determineContextSignal", () => {
  it("returns CERTAIN when ECLI matches", () => {
    const result = determineContextSignal("some text", ["Rhône"], { hasEcliMatch: true });
    expect(result.signal).toBe("CERTAIN");
    expect(result.jurisdictionCity).toBeNull();
  });

  it("returns CERTAIN when pourvoi matches", () => {
    const result = determineContextSignal("some text", ["Paris"], { hasPourvoiMatch: true });
    expect(result.signal).toBe("CERTAIN");
    expect(result.jurisdictionCity).toBeNull();
  });

  it("returns CERTAIN when both ECLI and pourvoi match", () => {
    const result = determineContextSignal("some text", ["Paris"], {
      hasEcliMatch: true,
      hasPourvoiMatch: true,
    });
    expect(result.signal).toBe("CERTAIN");
  });

  it("returns POSITIVE when jurisdiction matches politician departments", () => {
    const result = determineContextSignal("arrêt de la cour d'appel de Lyon", ["Rhône"], undefined);
    expect(result.signal).toBe("POSITIVE");
    expect(result.jurisdictionCity).toBe("Lyon");
  });

  it("returns NEGATIVE when jurisdiction does not match departments", () => {
    const result = determineContextSignal(
      "arrêt de la cour d'appel de Bordeaux",
      ["Rhône"],
      undefined
    );
    expect(result.signal).toBe("NEGATIVE");
    expect(result.jurisdictionCity).toBe("Bordeaux");
  });

  it("returns NEUTRAL when no jurisdiction found in text", () => {
    const result = determineContextSignal("texte sans juridiction", ["Rhône"], undefined);
    expect(result.signal).toBe("NEUTRAL");
    expect(result.jurisdictionCity).toBeNull();
  });

  it("returns NEUTRAL when politician has no departments", () => {
    const result = determineContextSignal("arrêt de la cour d'appel de Lyon", [], undefined);
    expect(result.signal).toBe("NEUTRAL");
    expect(result.jurisdictionCity).toBe("Lyon");
  });

  it("returns NEUTRAL when no externalIdMatch provided and jurisdiction unknown", () => {
    const result = determineContextSignal("texte quelconque", ["Paris"]);
    expect(result.signal).toBe("NEUTRAL");
  });

  it("prefers CERTAIN over jurisdiction match when both present", () => {
    const result = determineContextSignal("arrêt de la cour d'appel de Lyon", ["Rhône"], {
      hasEcliMatch: true,
    });
    expect(result.signal).toBe("CERTAIN");
  });
});
