/**
 * Core interfaces for country-specific identity resolution adapters.
 * Language-agnostic — no French-specific code in this file.
 */

import type { SignalEvaluator } from "../signals/types";

export interface NormalizedName {
  /** Fully normalized string (lowercase, no diacritics, no particles) */
  normalized: string;
  /** Individual tokens */
  tokens: string[];
  /** Original input (for audit trail) */
  original: string;
}

export interface NameNormalizer {
  /** Normalize a full name string. Must be idempotent. */
  normalizeFull(name: string): NormalizedName;
  /** Normalize a last name (handles particles, compounds) */
  normalizeLastName(lastName: string): string;
  /** Normalize a first name (handles compounds, abbreviations) */
  normalizeFirstName(firstName: string): string;
  /** Tokenize a name into comparable components */
  tokenize(name: string): string[];
  /** Extract primary surname for blocking key */
  primarySurname(normalizedLastName: string): string | null;
}

export interface PhoneticEncoder {
  /** Generate one or more phonetic codes for a name */
  encode(name: string): string[];
  /** Compare two names phonetically (0-1 similarity) */
  similarity(name1: string, name2: string): number;
}

export interface VariantResolver {
  /** Generate all known name variants for Aho-Corasick patterns and alias matching */
  generateVariants(politician: {
    firstName: string;
    lastName: string;
    marriageName?: string;
    ballotName?: string;
  }): string[];
}

export interface BlockingKeyGenerator {
  /** Unique identifier for this blocking key type */
  readonly id: string;
  /** Generate blocking keys from a politician record */
  generateKeys(politician: {
    firstName: string | null;
    lastName: string;
    normalizedLastName: string;
  }): string[];
}

export interface CountryAdapter {
  /** ISO 3166-1 alpha-2 country code */
  readonly countryCode: string;
  /** Human-readable name */
  readonly name: string;
  readonly normalizer: NameNormalizer;
  readonly phoneticEncoder: PhoneticEncoder;
  readonly variantResolver: VariantResolver;
  /**
   * Country-specific signals added to the pipeline.
   * These are ADDED to the universal signals, not replacing them.
   */
  readonly additionalSignals: SignalEvaluator[];
  /**
   * Country-specific blocking key generators.
   * Added to universal blocking (exact + trigram + phonetic).
   */
  readonly additionalBlockingKeys: BlockingKeyGenerator[];
}
