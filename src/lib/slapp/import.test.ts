import { describe, expect, it } from "vitest";
import { parseCaseImport, CaseImportSchema } from "./import";

describe("parseCaseImport", () => {
  it("valide et mappe un cas CASE Coalition complet", () => {
    const input = {
      caseReference: "CASE-FR-001",
      affairTitle: "Affaire Lefebvre c/ Mediapart",
      politicianSlug: "test-politicien",
      asymmetry: { met: true, note: "Élu vs journaliste" },
      publicInterest: { met: true, note: "Critique politique" },
      disproportion: { met: true, note: "200k€ demandés" },
      outcomeUnfavorable: { met: false, note: "Procédure en cours" },
      externalQualification: {
        met: true,
        source: "https://www.the-case.eu/case/case-fr-001",
        qualifierName: "CASE Coalition",
      },
    };
    const result = parseCaseImport(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.affairTitle).toBe("Affaire Lefebvre c/ Mediapart");
      expect(result.data.criteria.qualificationRule).toBe("3of5");
      expect(result.data.criteria.externalQualification.qualifierName).toBe("CASE Coalition");
    }
  });

  it("rejette un payload sans titre", () => {
    const result = parseCaseImport({
      politicianSlug: "test",
      asymmetry: { met: true },
      publicInterest: { met: true },
      disproportion: { met: true },
      outcomeUnfavorable: { met: false },
      externalQualification: { met: false },
    });
    expect(result.success).toBe(false);
  });

  it("rejette un payload sans politicianSlug", () => {
    const result = parseCaseImport({
      affairTitle: "Test",
      asymmetry: { met: true },
      publicInterest: { met: true },
      disproportion: { met: true },
      outcomeUnfavorable: { met: false },
      externalQualification: { met: false },
    });
    expect(result.success).toBe(false);
  });

  it("calcule qualificationRule = criterion5_only quand seul le 5 documenté", () => {
    const result = parseCaseImport({
      affairTitle: "Cas RSF only",
      politicianSlug: "x",
      asymmetry: { met: false },
      publicInterest: { met: false },
      disproportion: { met: false },
      outcomeUnfavorable: { met: false },
      externalQualification: {
        met: true,
        source: "https://rsf.org/case",
        qualifierName: "RSF",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.criteria.qualificationRule).toBe("criterion5_only");
    }
  });

  it("rejette un cas avec aucune qualification (ni 3/5 ni criterion 5)", () => {
    const result = parseCaseImport({
      affairTitle: "Cas non qualifié",
      politicianSlug: "x",
      asymmetry: { met: true },
      publicInterest: { met: false },
      disproportion: { met: false },
      outcomeUnfavorable: { met: false },
      externalQualification: { met: false },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/qualification/i);
    }
  });

  it("préserve les notes par critère", () => {
    const result = parseCaseImport({
      affairTitle: "Avec notes",
      politicianSlug: "x",
      asymmetry: { met: true, note: "note 1" },
      publicInterest: { met: true, note: "note 2" },
      disproportion: { met: true, note: "note 3" },
      outcomeUnfavorable: { met: false, note: "en cours" },
      externalQualification: { met: false },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.criteria.asymmetry.note).toBe("note 1");
    }
  });
});

describe("CaseImportSchema", () => {
  it("expose un type Zod parsable", () => {
    expect(typeof CaseImportSchema.parse).toBe("function");
  });
});
