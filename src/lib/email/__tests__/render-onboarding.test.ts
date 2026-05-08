import { describe, it, expect } from "vitest";
import { renderOnboardingHtml } from "../render-onboarding";

describe("renderOnboardingHtml", () => {
  it("substitutes deputyName and deputyParty", () => {
    const html = renderOnboardingHtml({
      deputyName: "Marine Le Pen",
      deputyParty: "RN",
      deputyProfileUrl: "https://poligraph.fr/politiques/marine-le-pen",
      unsubscribeUrl: "https://poligraph.fr/api/newsletter/unsubscribe?token=abc",
    });
    expect(html).toContain("Marine Le Pen");
    expect(html).toContain("RN");
    expect(html).toContain("https://poligraph.fr/politiques/marine-le-pen");
  });

  it("substitutes empty string for null deputy and strips the deputy block", () => {
    const html = renderOnboardingHtml({
      deputyName: null,
      deputyParty: null,
      deputyProfileUrl: null,
      unsubscribeUrl: "https://poligraph.fr/api/newsletter/unsubscribe?token=abc",
    });
    expect(html).not.toContain("{{deputyName}}");
    expect(html).not.toContain("{{deputyParty}}");
    expect(html).not.toContain("Ton député");
    expect(html).not.toContain("()");
    expect(html).not.toContain('href=""');
    expect(html).toContain("https://poligraph.fr/api/newsletter/unsubscribe?token=abc");
  });
});
