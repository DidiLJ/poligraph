import { describe, it, expect } from "vitest";
import { classifyByRules } from "@/services/promises/theme-classifier";

describe("classifyByRules", () => {
  it("détecte le thème ECONOMIE_BUDGET sur un texte fiscal", () => {
    const text =
      "Je propose de baisser la TVA sur l'alimentation et de revoir l'impôt sur le revenu.";
    const result = classifyByRules(text);
    expect(result).not.toBeNull();
    expect(result?.theme).toBe("ECONOMIE_BUDGET");
    expect(result?.method).toBe("rules");
  });

  it("retourne null sur un texte sans mots-clés", () => {
    const text = "Bonjour à tous, c'est un beau jour.";
    expect(classifyByRules(text)).toBeNull();
  });

  it("détecte IMMIGRATION sur un texte frontière", () => {
    const text = "Nous devons reprendre le contrôle de nos frontières et réformer l'asile.";
    const result = classifyByRules(text);
    expect(result?.theme).toBe("IMMIGRATION");
  });
});
