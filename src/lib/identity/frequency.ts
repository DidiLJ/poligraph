import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

interface RawFrequencyRow {
  name: string;
  count: bigint;
}

/**
 * In-memory cache of normalized last name frequencies across the Politician table.
 * Used by the v2 identity resolver to compute name rarity for log-likelihood scoring.
 * A common name (e.g. "martin") has a high frequency → lower discriminating power.
 * A rare name (e.g. "melenchon") has a low frequency → higher discriminating power.
 */
export class NameFrequencyCache {
  private readonly counts: Map<string, number>;
  readonly totalRecords: number;
  readonly uniqueNames: number;

  private constructor(counts: Map<string, number>, totalRecords: number) {
    this.counts = counts;
    this.totalRecords = totalRecords;
    this.uniqueNames = counts.size;
  }

  /**
   * Build a cache from pre-computed counts. Intended for unit tests.
   */
  static fromCounts(counts: Map<string, number>, totalRecords: number): NameFrequencyCache {
    return new NameFrequencyCache(counts, totalRecords);
  }

  /**
   * Load frequencies from the Politician table.
   * Only rows with a non-null normalizedLastName are considered.
   */
  static async loadFromDb(): Promise<NameFrequencyCache> {
    const rows = await db.$queryRaw<RawFrequencyRow[]>(Prisma.sql`
      SELECT "normalizedLastName" AS name, COUNT(*)::bigint AS count
      FROM "Politician"
      WHERE "normalizedLastName" IS NOT NULL
      GROUP BY "normalizedLastName"
    `);

    const counts = new Map<string, number>();
    let total = 0;

    for (const row of rows) {
      const n = Number(row.count);
      counts.set(row.name, n);
      total += n;
    }

    return new NameFrequencyCache(counts, total);
  }

  /**
   * Return the relative frequency (0–1) of a normalized last name.
   * Returns undefined if the name is not present in the cache.
   */
  get(normalizedLastName: string): number | undefined {
    const count = this.counts.get(normalizedLastName);
    if (count === undefined) return undefined;
    if (this.totalRecords === 0) return 0;
    return count / this.totalRecords;
  }

  /**
   * Return the raw occurrence count for a normalized last name.
   * Returns undefined if the name is not present in the cache.
   */
  getCount(normalizedLastName: string): number | undefined {
    return this.counts.get(normalizedLastName);
  }
}
