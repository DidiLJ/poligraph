import { describe, it, expect } from "vitest";
import { involvementRequiresNote } from "@/lib/affairs/involvement-note";

/**
 * Une personne non mise en cause doit voir sa présence justifiée (RGPD art. 10, I3/I5).
 * Mais pour une victime ou un plaignant, le type d'implication le dit déjà : exiger une
 * note en plus est redondant. Pour une simple mention ou un lien indirect, le rôle reste
 * vague, et c'est la note qui porte la justification.
 */
describe("involvementRequiresNote", () => {
  it("exige une note pour une mention et un lien indirect", () => {
    expect(involvementRequiresNote("MENTIONED_ONLY")).toBe(true);
    expect(involvementRequiresNote("INDIRECT")).toBe(true);
  });

  it("n'exige pas de note quand le rôle s'explique de lui-même", () => {
    expect(involvementRequiresNote("DIRECT")).toBe(false);
    expect(involvementRequiresNote("VICTIM")).toBe(false);
    expect(involvementRequiresNote("PLAINTIFF")).toBe(false);
  });
});
