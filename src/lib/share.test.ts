import { describe, expect, it } from "vitest";
import { getShareText, getShareUrl } from "./share";

describe("getShareText", () => {
  it("should combine title, description and Poligraph suffix", () => {
    expect(getShareText("Jean Dupont", "Député du Rhône")).toBe(
      "Jean Dupont — Député du Rhône sur Poligraph"
    );
  });

  it("should fallback to title only when no description is provided", () => {
    expect(getShareText("Affaire des emplois fictifs")).toBe(
      "Affaire des emplois fictifs sur Poligraph"
    );
  });

  it("should keep accents and guillemets in the share text", () => {
    expect(getShareText("François Hollande", "A déclaré : « C’est faux »")).toBe(
      "François Hollande — A déclaré : « C’est faux » sur Poligraph"
    );
  });

  it("should truncate long texts to 250 characters and keep the suffix", () => {
    const longDescription =
      "Député du Rhône ".repeat(30) +
      "avec un historique politique particulièrement long et documenté";

    const shareText = getShareText("Jean Dupont", longDescription);

    expect(shareText.length).toBeLessThanOrEqual(250);
    expect(shareText.endsWith("… sur Poligraph")).toBe(true);
  });

  it("should produce different texts for different page contexts", () => {
    const politicianText = getShareText("Jean Dupont", "Député du Rhône");
    const factCheckText = getShareText(
      "Budget 2026 : ce que dit vraiment la réforme",
      "Faux — « la dette a baissé »"
    );

    expect(politicianText).not.toBe(factCheckText);
  });

  it("should not inject non-neutral wording into affair share text", () => {
    const shareText = getShareText(
      "Affaire des emplois fictifs",
      "Affaire en cours documentée à partir de sources publiques"
    );

    expect(shareText).toContain("Affaire en cours");
    expect(shareText).not.toMatch(/coupable|condamné|condamnee/i);
  });
});

describe("getShareUrl", () => {
  const url = "https://poligraph.fr/politiques/jean-dupont";
  const text = "Jean Dupont — Député du Rhône sur Poligraph";

  it("should generate the X intent URL", () => {
    const shareUrl = new URL(getShareUrl("x", url, text));

    expect(`${shareUrl.origin}${shareUrl.pathname}`).toBe("https://x.com/intent/post");
    expect(shareUrl.searchParams.get("text")).toBe(text);
    expect(shareUrl.searchParams.get("url")).toBe(url);
  });

  it("should generate the Bluesky intent URL with the URL in the text body", () => {
    const shareUrl = new URL(getShareUrl("bluesky", url, text));

    expect(`${shareUrl.origin}${shareUrl.pathname}`).toBe("https://bsky.app/intent/compose");
    expect(shareUrl.searchParams.get("text")).toBe(`${text} ${url}`);
  });

  it("should generate the Facebook share URL", () => {
    const shareUrl = new URL(getShareUrl("facebook", url, text));

    expect(`${shareUrl.origin}${shareUrl.pathname}`).toBe(
      "https://www.facebook.com/sharer/sharer.php"
    );
    expect(shareUrl.searchParams.get("u")).toBe(url);
  });

  it("should generate the WhatsApp share URL with text and URL together", () => {
    const shareUrl = new URL(getShareUrl("whatsapp", url, text));

    expect(`${shareUrl.origin}${shareUrl.pathname}`).toBe("https://wa.me/");
    expect(shareUrl.searchParams.get("text")).toBe(`${text} ${url}`);
  });

  it("should truncate Bluesky text when text + URL exceeds 300 characters", () => {
    const longText = "A".repeat(280);
    const longUrl = "https://poligraph.fr/votes/very-long-slug";
    const shareUrl = new URL(getShareUrl("bluesky", longUrl, longText));
    const blueskyText = shareUrl.searchParams.get("text")!;

    expect(blueskyText.length).toBeLessThanOrEqual(300);
    expect(blueskyText).toContain(longUrl);
    expect(blueskyText).toContain("…");
  });

  it("should encode special characters safely in share URLs", () => {
    const specialText = getShareText("Éric Coquerel", 'A déclaré : "c\'est déjà fait"');
    const specialUrl =
      "https://poligraph.fr/factchecks/eric-coquerel?source=Assemblée nationale&quote=économie";

    const shareUrl = new URL(getShareUrl("x", specialUrl, specialText));

    expect(shareUrl.searchParams.get("text")).toBe(specialText);
    expect(shareUrl.searchParams.get("url")).toBe(specialUrl);
  });
});
