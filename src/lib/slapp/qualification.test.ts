import { describe, expect, it } from "vitest";
import { evaluateQualification, isQualified } from "./qualification";
import type { SlappCriteriaPayload } from "@/config/slapp";

function baseCriteria(): SlappCriteriaPayload {
  return {
    asymmetry: { met: false },
    publicInterest: { met: false },
    disproportion: { met: false },
    outcomeUnfavorable: { met: false },
    externalQualification: { met: false },
    qualificationRule: "3of5",
  };
}

describe("evaluateQualification", () => {
  it("rejette si aucun critère n'est rempli", () => {
    const result = evaluateQualification(baseCriteria());
    expect(result.qualified).toBe(false);
    expect(result.metCount).toBe(0);
  });

  it("rejette avec seulement 2 critères sur les 4 premiers", () => {
    const criteria = baseCriteria();
    criteria.asymmetry.met = true;
    criteria.publicInterest.met = true;
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(false);
    expect(result.metCount).toBe(2);
  });

  it("qualifie via règle 3/5 avec 3 critères non-5", () => {
    const criteria = baseCriteria();
    criteria.asymmetry.met = true;
    criteria.publicInterest.met = true;
    criteria.disproportion.met = true;
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(true);
    expect(result.rule).toBe("3of5");
    expect(result.metCount).toBe(3);
  });

  it("qualifie via règle 3/5 quand 3 critères dont le 5 sont rencontrés", () => {
    const criteria = baseCriteria();
    criteria.asymmetry.met = true;
    criteria.publicInterest.met = true;
    criteria.externalQualification = {
      met: true,
      source: "https://rsf.org/x",
      qualifierName: "RSF",
    };
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(true);
    expect(result.rule).toBe("3of5");
    expect(result.metCount).toBe(3);
  });

  it("qualifie via règle critère 5 seul avec source documentée", () => {
    const criteria = baseCriteria();
    criteria.externalQualification = {
      met: true,
      source: "https://www.the-case.eu/case/abc",
      qualifierName: "CASE Coalition",
    };
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(true);
    expect(result.rule).toBe("criterion5_only");
    expect(result.metCount).toBe(1);
  });

  it("rejette critère 5 seul sans source documentée", () => {
    const criteria = baseCriteria();
    criteria.externalQualification = { met: true };
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(false);
    expect(result.rule).toBeNull();
  });

  it("rejette critère 5 sans qualifierName même si source présente", () => {
    const criteria = baseCriteria();
    criteria.externalQualification = { met: true, source: "https://x" };
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(false);
  });

  it("retourne metCount=5 et rule=3of5 quand tous les critères sont remplis", () => {
    const criteria = baseCriteria();
    criteria.asymmetry.met = true;
    criteria.publicInterest.met = true;
    criteria.disproportion.met = true;
    criteria.outcomeUnfavorable.met = true;
    criteria.externalQualification = {
      met: true,
      source: "https://x",
      qualifierName: "RSF",
    };
    const result = evaluateQualification(criteria);
    expect(result.qualified).toBe(true);
    expect(result.rule).toBe("3of5");
    expect(result.metCount).toBe(5);
  });
});

describe("isQualified", () => {
  it("retourne true quand la qualification est valide", () => {
    const criteria = baseCriteria();
    criteria.asymmetry.met = true;
    criteria.publicInterest.met = true;
    criteria.disproportion.met = true;
    expect(isQualified(criteria)).toBe(true);
  });

  it("retourne false quand la qualification échoue", () => {
    expect(isQualified(baseCriteria())).toBe(false);
  });
});
