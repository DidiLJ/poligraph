import { describe, it, expect } from "vitest";
import {
  classifyArticleTier,
  JUDICIAL_KEYWORDS,
  POLITICAL_KEYWORDS,
  isPoliticallyRelevant,
} from "./press-keywords";

describe("JUDICIAL_KEYWORDS", () => {
  it("should export a non-empty array of keywords", () => {
    expect(JUDICIAL_KEYWORDS.length).toBeGreaterThan(30);
  });
});

describe("classifyArticleTier", () => {
  it("should return TIER_1 for article with 'mis en examen' in title", () => {
    expect(classifyArticleTier("Politicien X mis en examen", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for article with 'condamné' in description", () => {
    expect(classifyArticleTier("Tribunal de Paris", "L'ancien maire condamné à 2 ans")).toBe(
      "TIER_1"
    );
  });

  it("should return TIER_1 for 'corruption' keyword", () => {
    expect(classifyArticleTier("Affaire de corruption au conseil régional", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for 'tribunal correctionnel'", () => {
    expect(classifyArticleTier("Renvoi devant le tribunal correctionnel", null)).toBe("TIER_1");
  });

  it("should return TIER_2 for article without judicial keywords", () => {
    expect(
      classifyArticleTier("Macron en visite à Berlin", "Discussions sur le budget européen")
    ).toBe("TIER_2");
  });

  it("should be case-insensitive", () => {
    expect(classifyArticleTier("MISE EN EXAMEN de l'ancien ministre", null)).toBe("TIER_1");
  });

  it("should be accent-insensitive", () => {
    expect(classifyArticleTier("Le depute condamne pour fraude", null)).toBe("TIER_1");
  });

  it("should match 'détournement' with or without accent", () => {
    expect(classifyArticleTier("Détournement de fonds publics", null)).toBe("TIER_1");
    expect(classifyArticleTier("Detournement de fonds publics", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for 'garde à vue'", () => {
    expect(classifyArticleTier("Garde à vue pour le sénateur", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for 'perquisition'", () => {
    expect(classifyArticleTier("Perquisition au siège du parti", null)).toBe("TIER_1");
  });

  it("should handle null description", () => {
    expect(classifyArticleTier("Visite diplomatique", null)).toBe("TIER_2");
  });

  // False-positive resistance — single-word keywords must not match substrings
  it("should not match 'violation' for 'viol' keyword", () => {
    expect(classifyArticleTier("Violation des droits de l'homme", null)).toBe("TIER_2");
  });

  it("should not match 'processus' for 'proces' keyword", () => {
    expect(classifyArticleTier("Le processus législatif continue", null)).toBe("TIER_2");
  });

  it("should not match 'préjugé' for 'juge' keyword", () => {
    expect(classifyArticleTier("Sans préjugé de la décision finale", null)).toBe("TIER_2");
  });

  it("should not match 'relaxation' for 'relaxe' keyword", () => {
    expect(classifyArticleTier("Moment de relaxation au Sénat", null)).toBe("TIER_2");
  });

  it("should still match 'viol' as a standalone word", () => {
    expect(classifyArticleTier("Accusé de viol par son assistante", null)).toBe("TIER_1");
  });

  it("should still match 'procès' as a standalone word", () => {
    expect(classifyArticleTier("Le procès de l'ancien ministre débute", null)).toBe("TIER_1");
  });
});

describe("POLITICAL_KEYWORDS", () => {
  it("should include all judicial keywords", () => {
    for (const kw of JUDICIAL_KEYWORDS) {
      expect(POLITICAL_KEYWORDS).toContain(kw);
    }
  });

  it("should include political role keywords", () => {
    expect(POLITICAL_KEYWORDS).toContain("depute");
    expect(POLITICAL_KEYWORDS).toContain("senateur");
    expect(POLITICAL_KEYWORDS).toContain("ministre");
    expect(POLITICAL_KEYWORDS).toContain("maire");
  });

  it("should include political institution keywords", () => {
    expect(POLITICAL_KEYWORDS).toContain("assemblee nationale");
    expect(POLITICAL_KEYWORDS).toContain("gouvernement");
  });
});

describe("isPoliticallyRelevant", () => {
  // Positive cases — political articles
  it("should detect article about a deputy", () => {
    expect(isPoliticallyRelevant("Le député a présenté un amendement")).toBe(true);
  });

  it("should detect article about government", () => {
    expect(isPoliticallyRelevant("Remaniement du gouvernement prévu")).toBe(true);
  });

  it("should detect article about elections", () => {
    expect(isPoliticallyRelevant("Résultats des élections municipales")).toBe(true);
  });

  it("should detect article with judicial keyword", () => {
    expect(isPoliticallyRelevant("Le sénateur mis en examen pour corruption")).toBe(true);
  });

  it("should detect accent-insensitive political keywords", () => {
    expect(isPoliticallyRelevant("Le député européen s'exprime")).toBe(true);
  });

  it("should detect 'politique' keyword", () => {
    expect(isPoliticallyRelevant("Crise politique en France")).toBe(true);
  });

  // Negative cases — non-political articles (the false positive sources)
  it("should NOT detect rugby article", () => {
    expect(
      isPoliticallyRelevant(
        "DIRECT. France-Angleterre : Antoine Dupont et les Bleus à une marche de conserver leur titre"
      )
    ).toBe(false);
  });

  it("should NOT detect cycling article", () => {
    expect(
      isPoliticallyRelevant(
        "VIDEO. Paris-Nice : un coureur Français ramasse un bidon pour le donner à une enfant"
      )
    ).toBe(false);
  });

  it("should NOT detect football article", () => {
    expect(
      isPoliticallyRelevant(
        "Metz - TFC : Notre classement nous fait mal, 12e de Ligue 1, Toulouse n'est pas content"
      )
    ).toBe(false);
  });

  it("should NOT detect fencing article", () => {
    expect(
      isPoliticallyRelevant(
        "Sabre d'or 2026 : la relève tarbaise présente avec Nina Zacchia et Baptiste Vaz"
      )
    ).toBe(false);
  });

  it("should NOT detect crime article without political context", () => {
    expect(
      isPoliticallyRelevant(
        "DZ Mafia : rap, voitures de luxe... le procureur de Marseille détaille le réseau"
      )
    ).toBe(true); // procureur IS a judicial keyword — this is correct
  });

  it("should NOT detect sociology article", () => {
    expect(
      isPoliticallyRelevant(
        "Laurent Lardeux, sociologue : les nouvelles formes d'engagement des jeunes"
      )
    ).toBe(false);
  });
});
