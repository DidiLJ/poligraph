import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  const result = manifest();

  it("expose le nom et le short_name Poligraph", () => {
    expect(result.name).toBe("Poligraph");
    expect(result.short_name).toBe("Poligraph");
  });

  it("utilise le bleu République comme theme_color", () => {
    expect(result.theme_color).toBe("#002654");
  });

  it("affiche en standalone depuis la racine", () => {
    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/");
    expect(result.scope).toBe("/");
  });

  it("référence les icônes 192 et 512 maskable", () => {
    const sizes = result.icons?.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    const purposes = result.icons?.map((i) => i.purpose);
    expect(purposes).toContain("maskable");
  });

  it("est en français", () => {
    expect(result.lang).toBe("fr");
    expect(result.dir).toBe("ltr");
  });

  it("fournit une description civique", () => {
    expect(result.description).toContain("Observatoire");
  });
});
