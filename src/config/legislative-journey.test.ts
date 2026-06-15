import { describe, it, expect } from "vitest";
import { LEGISLATIVE_JOURNEY_STEPS } from "./legislative-journey";

describe("LEGISLATIVE_JOURNEY_STEPS", () => {
  it("exposes the 6 ordered steps starting at Dépôt", () => {
    expect(LEGISLATIVE_JOURNEY_STEPS).toHaveLength(6);
    expect(LEGISLATIVE_JOURNEY_STEPS[0]?.label).toBe("Dépôt");
    LEGISLATIVE_JOURNEY_STEPS.forEach((step) => {
      expect(typeof step.label).toBe("string");
      expect(step.label.length).toBeGreaterThan(0);
      expect(typeof step.description).toBe("string");
      expect(step.description.length).toBeGreaterThan(0);
    });
  });

  it("keeps adoption and promulgation as distinct steps (no conflation)", () => {
    const adoption = LEGISLATIVE_JOURNEY_STEPS.find((s) => /adoption/i.test(s.label));
    const promulgation = LEGISLATIVE_JOURNEY_STEPS.find((s) =>
      /promulgation|constitutionnel/i.test(s.label)
    );
    expect(adoption).toBeDefined();
    expect(promulgation).toBeDefined();
    expect(adoption).not.toBe(promulgation);

    // The adoption step must not claim promulgation or entry into force.
    const adoptionText = `${adoption!.label} ${adoption!.description}`.toLowerCase();
    expect(adoptionText).not.toContain("promulg");
    expect(adoptionText).not.toContain("en vigueur");
  });

  it("does not reduce the journey to 'le Président promulgue la loi' as an isolated step", () => {
    const hasReductiveStep = LEGISLATIVE_JOURNEY_STEPS.some((s) =>
      /le président de la république promulgue la loi/i.test(`${s.label} ${s.description}`)
    );
    expect(hasReductiveStep).toBe(false);
  });
});
