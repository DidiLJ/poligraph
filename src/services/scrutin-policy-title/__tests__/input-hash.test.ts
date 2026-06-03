import { describe, it, expect } from "vitest";
import { computeInputHash, type InputHashInput } from "@/services/scrutin-policy-title/input-hash";

const baseInput = (): InputHashInput => ({
  scrutinTitle: "le sous-amendement n° 2368 ...",
  scrutinSourceUrl: "https://an.fr/x",
  proceduralLabel: "Sous-amendement n°2368",
  links: [
    { amendmentId: "a-sub", amendmentNumber: "2368", role: "SUB_AMENDMENT" },
    { amendmentId: "a-par", amendmentNumber: "2058", role: "PARENT_AMENDMENT" },
  ],
  sources: [
    {
      sourceType: "subAmendment",
      sourceId: "a-sub",
      field: "Amendment.summary",
      text: "supprime l'exonération",
    },
    {
      sourceType: "parentAmendment",
      sourceId: "a-par",
      field: "Amendment.content",
      text: "contenu parent",
    },
  ],
});

describe("computeInputHash", () => {
  it("returns a full 64-char SHA-256 hex", () => {
    const h = computeInputHash(baseInput());
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is order-invariant over links and sources", () => {
    const a = computeInputHash(baseInput());
    const shuffled = baseInput();
    shuffled.links.reverse();
    shuffled.sources.reverse();
    expect(computeInputHash(shuffled)).toBe(a);
  });

  it("flips when block text changes", () => {
    const a = computeInputHash(baseInput());
    const changed = baseInput();
    changed.sources[0]!.text = "AUTRE TEXTE";
    expect(computeInputHash(changed)).not.toBe(a);
  });

  it("flips when scrutin title changes", () => {
    const a = computeInputHash(baseInput());
    const changed = baseInput();
    changed.scrutinTitle = "autre titre";
    expect(computeInputHash(changed)).not.toBe(a);
  });

  it("flips when a link ROLE changes (same amendment PARENT → SUB)", () => {
    const a = computeInputHash(baseInput());
    const changed = baseInput();
    changed.links[1]!.role = "SUB_AMENDMENT"; // was PARENT_AMENDMENT
    expect(computeInputHash(changed)).not.toBe(a);
  });
});
