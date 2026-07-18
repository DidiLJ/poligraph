import { describe, it, expect } from "vitest";
import { AFFAIRES_DEFAULT_TITLE, AFFAIRES_DEFAULT_DESCRIPTION } from "../affaires-metadata";

describe("affaires default SEO copy", () => {
  it("keeps the earning keyword head in the title", () => {
    expect(AFFAIRES_DEFAULT_TITLE).toContain(
      "Affaires judiciaires des responsables politiques français"
    );
  });

  it("distinguishes mise en cause from condamnation in both title and description", () => {
    for (const text of [AFFAIRES_DEFAULT_TITLE, AFFAIRES_DEFAULT_DESCRIPTION]) {
      expect(text.toLowerCase()).toContain("mises en cause");
      expect(text.toLowerCase()).toContain("condamnation");
    }
  });

  it("states the presumption of innocence (legal caution)", () => {
    expect(AFFAIRES_DEFAULT_DESCRIPTION.toLowerCase()).toContain("présomption d'innocence");
  });

  it("avoids overreaching wording", () => {
    // No blanket "toutes/tous les" claim, no guilt language on the listing itself.
    const desc = AFFAIRES_DEFAULT_DESCRIPTION.toLowerCase();
    expect(desc).not.toContain("coupable");
    expect(desc).not.toMatch(/\btoutes les affaires\b/);
  });

  it("stays within sane SERP length bounds", () => {
    // Title head is fully visible; the clause may truncate (upside-only).
    expect(AFFAIRES_DEFAULT_TITLE.length).toBeLessThanOrEqual(95);
    expect(AFFAIRES_DEFAULT_DESCRIPTION.length).toBeLessThanOrEqual(200);
    // Key terms sit in the first ~160 chars that Google actually renders.
    const front = AFFAIRES_DEFAULT_DESCRIPTION.slice(0, 160).toLowerCase();
    expect(front).toContain("mises en cause");
    expect(front).toContain("condamnation");
  });
});
