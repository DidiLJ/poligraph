import type { PhoneticEncoder } from "../types";

/**
 * French phonetic encoder producing consonant-skeleton codes from surnames.
 *
 * Handles common French phonetic patterns:
 * - Digraph substitutions (ch, ph, th, gn, qu, gu)
 * - Nasal vowels (an/en -> A, in/ain/ein -> E, on -> O, un -> E)
 * - Vowel clusters (ou, au/eau, ai/ei, oi)
 * - Context-sensitive consonants (c/g before e/i)
 * - Silent final consonants (CaReFuL rule: keep c, r, f, l)
 * - b/v ambiguity: generate two codes (all-V and all-B variants)
 */
export class FrenchPhoneticEncoder implements PhoneticEncoder {
  private stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Apply French phonetic substitution rules to a normalized (lowercase,
   * accent-free) string and return a consonant-skeleton code.
   */
  private applyRules(s: string): string {
    let v = s;

    // Remove silent leading 'h'
    v = v.replace(/^h+/, "");

    // Digraph substitutions (longer patterns first)
    v = v.replace(/ch/g, "S");
    v = v.replace(/ph/g, "F");
    v = v.replace(/th/g, "T");
    v = v.replace(/gn/g, "N");
    v = v.replace(/qu/g, "K");
    // gu before e/i -> G (keep single G)
    v = v.replace(/gu(?=[ei])/g, "G");

    // Nasal vowel clusters (must be handled before single-vowel rules)
    v = v.replace(/(?:an|am|en|em)/g, "A");
    v = v.replace(/(?:ain|ein|in|im)/g, "E");
    v = v.replace(/(?:on|om)/g, "O");
    v = v.replace(/(?:un|um)/g, "E");

    // Vowel cluster substitutions
    v = v.replace(/ou/g, "U");
    v = v.replace(/(?:eau|au)/g, "O");
    v = v.replace(/(?:ai|ei)/g, "E");
    v = v.replace(/oi/g, "WA");

    // Context-sensitive consonants
    // c before e/i -> S, else K  (digraph ch already consumed)
    v = v.replace(/c(?=[eiEI])/g, "S");
    v = v.replace(/c/g, "K");
    // g before e/i -> J
    v = v.replace(/g(?=[eiEI])/g, "J");

    // Double consonants -> single
    v = v.replace(/([bcdfghjklmnpqrstvwxyz])\1+/gi, "$1");

    // Silent final consonant rule (CaReFuL: c, r, f, l are excluded from the char class)
    v = v.replace(/[bdgjkmnpqstvwxyz]$/i, "");

    // Strip remaining lowercase vowels (uppercase substitution markers A/E/O/U are kept)
    // Preserve a leading vowel as an anchor character
    const leadingVowel = /^[aeiouAEIOUy]/.test(v) ? v[0] : "";
    const rest = leadingVowel ? v.slice(1) : v;
    v = leadingVowel + rest.replace(/[aeiouy]/g, "");

    return v.toUpperCase();
  }

  private normalize(name: string): string {
    return this.stripAccents(name.toLowerCase().trim());
  }

  /**
   * Generate one or more phonetic codes for a name.
   *
   * When the name contains 'b' or 'v', generates two codes by normalizing
   * all b->v (all-V variant) and all v->b (all-B variant). This handles
   * the classic lefebvre/lefevre ambiguity where b and v are phonetically
   * interchangeable in many French dialects.
   *
   * Returns an empty array for empty input.
   */
  encode(name: string): string[] {
    const normalized = this.normalize(name);
    if (normalized.length === 0) return [];

    const hasB = normalized.includes("b");
    const hasV = normalized.includes("v");

    if (hasB || hasV) {
      // all-V variant: treat all b as v
      const allV = normalized.replace(/b/g, "v");
      const codeV = this.applyRules(allV);
      // all-B variant: treat all v as b
      const allB = normalized.replace(/v/g, "b");
      const codeB = this.applyRules(allB);
      return codeV === codeB ? [codeV] : [codeV, codeB];
    }

    return [this.applyRules(normalized)];
  }

  /**
   * Return 1.0 if any phonetic code from name1 matches any code from name2,
   * 0.0 otherwise.
   */
  similarity(name1: string, name2: string): number {
    const codes1 = this.encode(name1);
    const codes2 = new Set(this.encode(name2));
    for (const code of codes1) {
      if (codes2.has(code)) return 1.0;
    }
    return 0.0;
  }
}
