import type { NameComparator } from "./types";

/**
 * Optimal String Alignment (OSA) variant of Damerau-Levenshtein distance.
 * Supports insertion, deletion, substitution, and transposition.
 * Transposition always costs 1.
 */
export class DamerauLevenshteinComparator implements NameComparator {
  readonly id = "damerau-levenshtein";

  compare(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const m = a.length;
    const n = b.length;

    // d[i][j] = OSA distance between a[0..i-1] and b[0..j-1]
    const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        d[i][j] = Math.min(
          d[i - 1][j] + 1, // deletion
          d[i][j - 1] + 1, // insertion
          d[i - 1][j - 1] + cost // substitution
        );

        // transposition
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }

    const distance = d[m][n];
    return 1 - distance / Math.max(m, n);
  }
}

export const damerauLevenshtein = new DamerauLevenshteinComparator();
