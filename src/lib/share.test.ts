import { describe, it, expect } from "vitest";
import { buildShareUrl } from "./share";

describe("buildShareUrl", () => {
  const url = "https://poligraph.fr/politiques/marine-le-pen";
  const text = "Marine Le Pen, Députée (RN)";

  it("builds X share URL with text and url params", () => {
    const result = buildShareUrl("x", text, url);
    expect(result).toContain("https://x.com/intent/tweet");
    expect(result).toContain(encodeURIComponent(text));
    expect(result).toContain(encodeURIComponent(url));
  });

  it("builds Bluesky compose URL with text + url in body", () => {
    const result = buildShareUrl("bluesky", text, url);
    expect(result).toContain("https://bsky.app/intent/compose");
    expect(result).toContain(encodeURIComponent(url));
  });

  it("truncates long text for Bluesky to fit 300 chars", () => {
    const longText = "A".repeat(400);
    const result = buildShareUrl("bluesky", longText, url);
    const decoded = decodeURIComponent(result.split("text=")[1]!);
    expect(decoded.length).toBeLessThanOrEqual(300);
    expect(decoded).toContain("...");
  });

  it("builds Facebook sharer URL with url only", () => {
    const result = buildShareUrl("facebook", text, url);
    expect(result).toContain("https://www.facebook.com/sharer/sharer.php");
    expect(result).toContain(encodeURIComponent(url));
  });

  it("builds WhatsApp URL with text and url", () => {
    const result = buildShareUrl("whatsapp", text, url);
    expect(result).toContain("https://wa.me/");
    expect(result).toContain(encodeURIComponent(url));
  });
});
