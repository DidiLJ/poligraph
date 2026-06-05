import type { EvidenceCandidate, SubstanceTextBlock } from "./types";

/**
 * Curated French policy verb-stems. Matched case-insensitively as substrings on
 * accent-normalized text so conjugations hit (e.g. "supprime", "supprimer",
 * "supprimera" all match the stem "supprim").
 */
const POLICY_VERBS = [
  "creer", // créer
  "supprim",
  "retabli", // rétabli
  "restrein",
  "autoris",
  "interdi",
  "etend", // étend
  "redui", // rédui
  "simplifi",
  "acceler", // accélér
  "retard",
  "abrog",
  "modifi",
  "exoner", // exonér
  "limit",
  "renforc",
  "oblig",
  "encadr",
  "instaur",
  "elargi", // élargi
  "plafonn",
  "exclu",
  "inclu",
] as const;

/** Procedural nouns (accent-normalized, lowercased). A sentence mentioning only
 *  these has no concrete policy object. */
const PROCEDURAL_NOUNS = new Set<string>([
  "article",
  "amendement",
  "amendements",
  "sous-amendement",
  "projet",
  "proposition",
  "loi",
  "lecture",
  "examen",
  "scrutin",
  "alinea", // alinéa
  "redaction", // rédaction
]);

/** Minimal French stopword set for keyword extraction. */
const STOPWORDS = new Set<string>([
  "alors",
  "aux",
  "avec",
  "cette",
  "celui",
  "celle",
  "certains",
  "certaines",
  "comme",
  "dans",
  "des",
  "donc",
  "elle",
  "elles",
  "leur",
  "leurs",
  "mais",
  "meme",
  "notre",
  "nous",
  "pour",
  "present",
  "presente",
  "quand",
  "sans",
  "ses",
  "son",
  "sont",
  "sous",
  "sur",
  "tous",
  "tout",
  "toute",
  "toutes",
  "une",
  "vers",
  "votre",
  "vous",
  "disposition",
  "mesure",
  "vise",
]);

/** Lowercase + strip diacritics. */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Split text into sentences on `.`, `!`, `?`, keeping only sentences longer
 *  than ~15 chars (trimmed). */
function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

/** Lowercased, accent-normalized content words (length > 3), minus stopwords and
 *  procedural nouns. These are the "concrete object" candidates. */
export function extractContentKeywords(sentence: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const raw of sentence.split(/[^A-Za-zÀ-ÿ-]+/)) {
    if (!raw) continue;
    const word = normalize(raw);
    if (word.length <= 3) continue;
    if (STOPWORDS.has(word)) continue;
    if (PROCEDURAL_NOUNS.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    keywords.push(word);
  }
  return keywords;
}

/** A sentence "looks concrete" when at least one keyword remains after removing
 *  procedural nouns and stopwords. */
function looksConcrete(keywords: string[]): boolean {
  return keywords.length >= 1;
}

function hasPolicyVerb(normalizedSentence: string): boolean {
  return POLICY_VERBS.some((stem) => normalizedSentence.includes(stem));
}

/**
 * Deterministically extracts evidence-candidate sentences from OFFICIAL substance
 * blocks. Each sentence is scored: +2 for a policy verb, +3 for a concrete object.
 * Sentences with weight 0 are dropped. Returns the top 8 by weight (desc).
 */
export function extractEvidenceCandidates(blocks: SubstanceTextBlock[]): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  for (const block of blocks) {
    if (block.trust !== "official") continue;

    for (const sentence of sentenceSplit(block.text)) {
      const normalized = normalize(sentence);
      const keywords = extractContentKeywords(sentence);

      let weight = 0;
      if (hasPolicyVerb(normalized)) weight += 2;
      if (looksConcrete(keywords)) weight += 3;
      if (weight === 0) continue;

      const startOffset = block.text.indexOf(sentence);
      const endOffset = startOffset >= 0 ? startOffset + sentence.length : undefined;

      candidates.push({
        sourceType: block.sourceType,
        sourceId: block.sourceId,
        field: block.field,
        quote: sentence,
        startOffset: startOffset >= 0 ? startOffset : undefined,
        endOffset,
        url: block.url,
        keywords,
        weight,
      });
    }
  }

  candidates.sort((a, b) => b.weight - a.weight);
  return candidates.slice(0, 8);
}
