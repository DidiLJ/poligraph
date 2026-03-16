/**
 * Name comparator interface. Implementations added in Phase 2:
 * - ExactComparator
 * - JaroWinklerComparator
 * - DamerauLevenshteinComparator
 * - MongeElkanComparator
 * - PhoneticComparator
 */

export interface NameComparator {
  /** Unique identifier */
  readonly id: string;
  /** Compare two strings, return 0-1 similarity */
  compare(a: string, b: string): number;
}
