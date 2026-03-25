import { describe, it, expect } from "vitest";
import { classifyScrutinTitle } from "@/lib/scrutin-type";

describe("classifyScrutinTitle", () => {
  describe("AMENDEMENT", () => {
    it("classifies standard amendment", () => {
      expect(
        classifyScrutinTitle(
          "l'amendement n° 1 du Gouvernement et l'amendement identique suivant a l'article 4 de la proposition de loi relative au droit a l'aide a mourir"
        )
      ).toBe("AMENDEMENT");
    });

    it("classifies amendment with Unicode apostrophe", () => {
      expect(classifyScrutinTitle("l\u2019amendement n\u00b0 42 de M. Dupont")).toBe("AMENDEMENT");
    });

    it("classifies plural amendments", () => {
      expect(
        classifyScrutinTitle(
          "les amendements identiques n° 12 et 34 a l'article 5 du projet de loi de finances"
        )
      ).toBe("AMENDEMENT");
    });

    it("classifies compound amendment with article reference", () => {
      expect(
        classifyScrutinTitle("l'amendement n° 256 de la commission a l'article 12 du projet de loi")
      ).toBe("AMENDEMENT");
    });

    it("classifies sous-amendement", () => {
      expect(
        classifyScrutinTitle(
          "le sous-amendement n° 12 de M. Dupont à l'amendement n° 45 à l'article 3"
        )
      ).toBe("AMENDEMENT");
    });

    it("classifies sous-amendement without parent reference", () => {
      expect(classifyScrutinTitle("le sous-amendement n° 789 de la commission")).toBe("AMENDEMENT");
    });
  });

  describe("MOTION", () => {
    it("classifies motion de rejet préalable (AN)", () => {
      expect(
        classifyScrutinTitle(
          "la motion de rejet préalable du projet de loi de financement de la sécurité sociale"
        )
      ).toBe("MOTION");
    });

    it("classifies motion de censure (art. 49-3)", () => {
      expect(classifyScrutinTitle("la motion de censure déposée par le groupe LFI")).toBe("MOTION");
    });

    it("classifies motion de renvoi en commission (AN)", () => {
      expect(classifyScrutinTitle("la motion de renvoi en commission du projet de loi")).toBe(
        "MOTION"
      );
    });

    it("classifies Sénat motion n° (renvoi en commission)", () => {
      expect(
        classifyScrutinTitle(
          "sur la motion n° 7, présentée par M. Jérémy Bacchi et les membres du groupe Communiste Républicain Citoyen et Écologiste, tendant au renvoi en commission de la proposition de loi"
        )
      ).toBe("MOTION");
    });

    it("classifies Sénat motion n° (question préalable)", () => {
      expect(
        classifyScrutinTitle(
          "sur la motion n° 2, présentée par Mme Sylvie Robert et les membres du groupe Socialiste, Écologiste et Républicain, tendant à opposer la question préalable"
        )
      ).toBe("MOTION");
    });

    it("classifies Sénat motion n° (exception d'irrecevabilité)", () => {
      expect(
        classifyScrutinTitle(
          "sur la motion n° 1, présentée par Mme Monique de Marco et les membres du groupe Écologiste, tendant à opposer l'exception d'irrecevabilité à la proposition de loi"
        )
      ).toBe("MOTION");
    });

    it("classifies motion référendaire (art. 11)", () => {
      expect(
        classifyScrutinTitle(
          "la motion référendaire, présentée par Mme Marine Le Pen et 59 députés, sur le projet de loi de financement rectificative de la sécurité sociale pour 2023"
        )
      ).toBe("MOTION");
    });

    it("classifies déclaration de politique générale (art. 49-1 confidence vote)", () => {
      expect(
        classifyScrutinTitle(
          "la déclaration de politique générale du Gouvernement de M. François Bayrou (application de l'article 49, alinéa premier, de la Constitution)."
        )
      ).toBe("MOTION");
    });

    it("classifies standalone exception d'irrecevabilité (pre-2009 AN)", () => {
      expect(
        classifyScrutinTitle(
          "l'exception d'irrecevabilité opposée au projet de loi relatif à la programmation militaire"
        )
      ).toBe("MOTION");
    });

    it("classifies standalone question préalable (pre-2009 AN)", () => {
      expect(
        classifyScrutinTitle("la question préalable opposée au projet de loi de finances pour 2008")
      ).toBe("MOTION");
    });
  });

  describe("FINAL", () => {
    it("classifies final vote on projet de loi", () => {
      expect(classifyScrutinTitle("l'ensemble du projet de loi de finances pour 2025")).toBe(
        "FINAL"
      );
    });

    it("classifies final vote on proposition de loi", () => {
      expect(
        classifyScrutinTitle(
          "l'ensemble de la proposition de loi relative au droit a l'aide a mourir"
        )
      ).toBe("FINAL");
    });

    it("classifies final vote with des", () => {
      expect(classifyScrutinTitle("l'ensemble des projets de loi relatifs a la securite")).toBe(
        "FINAL"
      );
    });

    it("classifies AN data typo: 'l'ensemble la proposition' (missing 'de')", () => {
      expect(
        classifyScrutinTitle(
          "l'ensemble la proposition de loi maintenant provisoirement un dispositif de plafonnement"
        )
      ).toBe("FINAL");
    });

    it("classifies budget section vote: première partie du PLFSS", () => {
      expect(
        classifyScrutinTitle(
          "la première partie du projet de loi de financement de la sécurité sociale pour 2023 (première lecture)."
        )
      ).toBe("FINAL");
    });

    it("classifies budget section vote: deuxième partie du PLFSS", () => {
      expect(
        classifyScrutinTitle(
          "la deuxième partie du projet de loi de financement de la sécurité sociale pour 2023 (nouvelle lecture)."
        )
      ).toBe("FINAL");
    });

    it("classifies l'ensemble de la Xe partie du projet", () => {
      expect(
        classifyScrutinTitle(
          "l'ensemble de la deuxième partie du projet de loi de financement de la sécurité sociale pour 2025 (première lecture)."
        )
      ).toBe("FINAL");
    });
  });

  describe("ARTICLE", () => {
    it("classifies numbered article", () => {
      expect(classifyScrutinTitle("l'article 7 du projet de loi de finances pour 2025")).toBe(
        "ARTICLE"
      );
    });

    it("classifies article unique", () => {
      expect(classifyScrutinTitle("l'article unique de la proposition de loi")).toBe("ARTICLE");
    });

    it("classifies article premier", () => {
      expect(classifyScrutinTitle("l'article premier du projet de loi")).toBe("ARTICLE");
    });

    it("classifies article liminaire", () => {
      expect(classifyScrutinTitle("l'article liminaire du projet de loi de finances")).toBe(
        "ARTICLE"
      );
    });

    it("does NOT classify constitutional article reference as ARTICLE", () => {
      // "l'article 49" here refers to the Constitution, not a bill section
      expect(
        classifyScrutinTitle(
          "la déclaration de politique générale du Gouvernement (application de l'article 49, alinéa premier, de la Constitution)."
        )
      ).not.toBe("ARTICLE");
    });
  });

  describe("AUTRE", () => {
    it("classifies unrecognized patterns", () => {
      expect(classifyScrutinTitle("la demande de suspension de séance")).toBe("AUTRE");
    });

    it("classifies propositions de résolution", () => {
      expect(
        classifyScrutinTitle(
          "la proposition de résolution en soutien au mouvement pour la liberté du peuple iranien (art. 34-1 de la Constitution)."
        )
      ).toBe("AUTRE");
    });

    it("classifies demande de constitution de commission spéciale", () => {
      expect(
        classifyScrutinTitle(
          "la demande de constitution d'une commission spéciale pour l'examen de la proposition de loi"
        )
      ).toBe("AUTRE");
    });
  });

  describe("priority: AMENDEMENT wins over ARTICLE", () => {
    it("amendment referencing an article is classified as AMENDEMENT", () => {
      expect(classifyScrutinTitle("l'amendement n° 1 a l'article 4 de la proposition de loi")).toBe(
        "AMENDEMENT"
      );
    });
  });

  describe("priority: MOTION wins over FINAL", () => {
    it("motion referencing a projet de loi stays MOTION", () => {
      expect(
        classifyScrutinTitle(
          "la motion de rejet préalable du projet de loi de financement de la sécurité sociale pour 2024"
        )
      ).toBe("MOTION");
    });
  });
});
