import type { NameComparator } from "./types";

/**
 * Monge-Elkan comparator for multi-token name strings.
 *
 * For each token in A, finds the best-matching token in B using an inner
 * comparator. The directed score is the mean of those best-match scores.
 * The final score is symmetric: Math.max(directed(A,B), directed(B,A)).
 *
 * Handles French compound names well: "jean-pierre dupont" vs "jean dupont".
 */
export class MongeElkanComparator implements NameComparator {
  readonly id = "monge-elkan";

  constructor(private readonly inner: NameComparator) {}

  compare(a: string, b: string): number {
    const tokA = tokenize(a);
    const tokB = tokenize(b);

    if (tokA.length === 0 && tokB.length === 0) return 1;
    if (tokA.length === 0 || tokB.length === 0) return 0;

    // Single-token on both sides: delegate directly to inner comparator
    if (tokA.length === 1 && tokB.length === 1) {
      return this.inner.compare(tokA[0]!, tokB[0]!);
    }

    return Math.max(this.directed(tokA, tokB), this.directed(tokB, tokA));
  }

  /** Mean over tokens in `source` of best-match score against any token in `target`. */
  private directed(source: string[], target: string[]): number {
    let sum = 0;
    for (const s of source) {
      let best = 0;
      for (const t of target) {
        const score = this.inner.compare(s, t);
        if (score > best) best = score;
      }
      sum += best;
    }
    return sum / source.length;
  }
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((t) => t.length > 0);
}
