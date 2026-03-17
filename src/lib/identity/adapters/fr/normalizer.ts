import type { NameNormalizer, NormalizedName } from "../types";

/**
 * French name normalizer. Extracts the normalization logic currently in
 * name-matching.ts normalizeText() and primarySurname() into the
 * NameNormalizer interface.
 *
 * This must produce IDENTICAL results to normalizeText() for all inputs
 * to preserve backward compatibility during Phase 1.
 */
export class FrenchNormalizer implements NameNormalizer {
  /** French particles to strip from tokenization (kept in normalized string for display) */
  private static PARTICLES = new Set(["de", "du", "d'", "l'", "des", "les", "la"]);

  /**
   * Core normalization: lowercase, remove accents, normalize separators.
   * Equivalent to normalizeText() in name-matching.ts.
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[-\u2013\u2014]/g, " ")
      .trim();
  }

  normalizeFull(name: string): NormalizedName {
    const normalized = this.normalize(name);
    const tokens = this.tokenize(name);
    return { normalized, tokens, original: name };
  }

  normalizeLastName(lastName: string): string {
    return this.normalize(lastName);
  }

  normalizeFirstName(firstName: string): string {
    return this.normalize(firstName);
  }

  /** Tokenize and strip French particles (de, du, la, etc.) */
  tokenize(name: string): string[] {
    return this.normalize(name)
      .split(/\s+/)
      .filter((t) => t.length > 0 && !FrenchNormalizer.PARTICLES.has(t));
  }

  /**
   * Extract primary surname from multi-word last name.
   * Equivalent to primarySurname() in name-matching.ts.
   */
  primarySurname(normalizedLastName: string): string | null {
    const parts = normalizedLastName.split(" ");
    const first = parts[0];
    if (!first || parts.length <= 1) return null;
    if (first.length <= 2) return null;
    return first;
  }
}
