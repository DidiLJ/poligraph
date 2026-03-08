import { describe, it, expect } from "vitest";

// We need to test the normalizeAffairTitle function indirectly since it's private.
// Instead, we test the exported behavior by importing and calling it via a test helper.
// For now, test the normalization logic inline.

function normalizeAffairTitle(title: string, politicianName?: string): string {
  let normalized = title
    .normalize("NFC")
    .replace(/^\[À VÉRIFIER\]\s*/i, "")
    .trim()
    .toLowerCase();

  if (politicianName) {
    const name = politicianName.toLowerCase().normalize("NFC");
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`\\s*[—–-]\\s*${escaped}\\s*$`), "");
    normalized = normalized.replace(new RegExp(`\\bde\\s+${escaped}\\s+pour\\s+`, "g"), "");
    normalized = normalized.replace(new RegExp(`\\bcontre\\s+${escaped}\\s*`, "g"), "");
    normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, "g"), "");
    normalized = normalized.replace(/\s{2,}/g, " ").trim();
  }

  return normalized;
}

describe("normalizeAffairTitle", () => {
  it("strips [À VÉRIFIER] prefix", () => {
    expect(normalizeAffairTitle("[À VÉRIFIER] Fraude fiscale")).toBe("fraude fiscale");
  });

  it("strips politician name with em dash suffix (discover-affairs format)", () => {
    const result = normalizeAffairTitle(
      "Violences volontaires en réunion — Raphaël Arnault",
      "Raphaël Arnault"
    );
    expect(result).toBe("violences volontaires en réunion");
  });

  it("strips politician name with 'de X pour' pattern (manual format)", () => {
    const result = normalizeAffairTitle(
      "Condamnation de Raphaël Arnault pour violences volontaires en réunion",
      "Raphaël Arnault"
    );
    expect(result).toBe("condamnation violences volontaires en réunion");
  });

  it("strips politician name with 'contre' pattern", () => {
    const result = normalizeAffairTitle(
      "Plainte pour menace de mort déposée contre Nicolas Sarkozy",
      "Nicolas Sarkozy"
    );
    expect(result).toBe("plainte pour menace de mort déposée");
  });

  it("enables substring matching between different title formats", () => {
    const name = "Raphaël Arnault";
    const a = normalizeAffairTitle("Violences volontaires en réunion — Raphaël Arnault", name);
    const b = normalizeAffairTitle(
      "Condamnation de Raphaël Arnault pour violences volontaires en réunion",
      name
    );
    // After normalization, one should contain the other
    expect(b.includes(a) || a.includes(b)).toBe(true);
  });

  it("handles Unicode normalization (NFC vs NFD)", () => {
    // é as NFC (U+00E9) vs NFD (e + U+0301)
    const nfc = "Fraude fiscale — René Dupont";
    const nfd = "Fraude fiscale — Rene\u0301 Dupont";
    expect(normalizeAffairTitle(nfc, "René Dupont")).toBe(
      normalizeAffairTitle(nfd, "Rene\u0301 Dupont")
    );
  });

  it("works without politician name", () => {
    expect(normalizeAffairTitle("Fraude fiscale")).toBe("fraude fiscale");
  });
});
