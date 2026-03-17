# How We Stopped Confusing Politicians: Building an Identity Resolution Engine for French Civic Data

_Building entity resolution for a small-scale civic tech project: practical lessons from the messy middle ground between academic ER and enterprise MDM._

---

## The Bug That Started It All

Thierry Cousin is the mayor of Saint-Pryve-Saint-Mesmin, a small town in the Loiret department. He was convicted in a financial misconduct case, and Poligraph (our civic observatory of French politicians) correctly tracks this affair.

Thierry Cousin is also the mayor of Betoncourt-Saint-Pancras, a village in Haute-Saone. He has no judicial record.

For months, our system thought they were the same person.

The RNE (Repertoire National des Elus) sync had matched the second Thierry Cousin's mayoral mandate to the first one's profile, because it found exactly one "Thierry Cousin" in our database and returned it without checking the birthdate. The convicted politician's profile now showed a mandate for a town 400km away.

This isn't just a data quality bug, it's a credibility problem. When civic tech platforms attribute criminal convictions to the wrong person, the consequences go beyond technical debt. A wrongly attributed affair can damage someone's reputation. A missing affair can undermine accountability.

We needed to fix this properly, not with another band-aid.

## What We Tried First

Our initial architecture was simple: each sync service (deputies, senators, mayors, declarations, court records) had its own matching function. The pattern was always the same:

```
1. Normalize the name
2. Query the database for matching names
3. If one result: return it
4. If multiple: try birthdate, then department
5. If still ambiguous: pick the first one (or give up)
```

When the Thierry Cousin bug surfaced, we added a birthdate check for single candidates. Problem solved?

Not really. The fix addressed one symptom, but the underlying architecture remained fragile:

- **10 sync services, 10 matching implementations.** Each one slightly different, each one a potential source of homonym bugs.
- **No shared memory.** If we flagged "Thierry Cousin from Haute-Saone is NOT the same person as Thierry Cousin from Loiret," that decision lived in a developer's head, not in the system.
- **No audit trail.** When a match happened, it was invisible. No confidence score, no method attribution, no way to review or undo.
- **No negative decisions.** The system could say "these are the same person" but had no way to say "these are definitely NOT the same person." This meant every sync run could potentially re-create the same wrong match.

## What the State of the Art Says

Before designing our solution, we researched how others solve entity resolution (ER):

**Fellegi-Sunter (1969):** the foundational probabilistic record linkage model. Compares fields independently, accumulates match/non-match weights, makes decisions based on composite scores. Our ad-hoc matching was an informal, unstructured version of this.

**OpenSanctions / nomenklatura:** the most relevant reference for our use case. OpenSanctions maintains 130K+ entity profiles across sanctions lists, PEP databases, and corporate registries. Their `nomenklatura` library uses a judgement graph: pairs of records are connected by SAME, NOT_SAME, or UNDECIDED edges. A connected components algorithm computes entity clusters. Key insight: they needed 34,600 manual decisions over 8 weeks to bootstrap the system. Negative decisions (NOT_SAME) are as important as positive ones.

**EveryPolitician (mySociety):** a project that tried to maintain comprehensive data on every politician worldwide. They used UUIDs + Popolo `identifiers[]` arrays + Wikidata as a linking hub. The project was archived after 4 years: the maintenance burden of multi-source reconciliation was unsustainable without proper tooling. A cautionary tale.

**W3C Reconciliation API v0.2:** a standard specification for entity matching services. Wikidata implements it. Enables interop with tools like OpenRefine for batch reconciliation.

**Key insight:** at our scale, deterministic matching (shared institutional IDs) covers 80%+ of cases. The critical missing pieces were **audit trail + negative decisions** (Phase 1), then **probabilistic scoring with name frequency weighting** (Phase 2).

## Phase 1: The Foundation

### The Resolver: One Pipeline to Rule Them All

Instead of 10 sync services each implementing their own matching, we built a single `IdentityResolver` with a centralized pipeline:

```
Prior decisions -> ExternalId match -> Signal evaluation -> Combiner -> Threshold -> Log
```

Each step either produces a result or hands off to the next. We introduced a **signal-based architecture**: composable evaluators that each assess one dimension of a match (birthdate, department, first name, gender).

### The Decision Log: The System Remembers

Every matching decision is recorded in an `IdentityDecision` table:

```
sourceType: RNE
sourceId: "70069"
politicianId: "cmlrjqfpq..."
judgement: NOT_SAME
confidence: 1.0
method: MANUAL
decidedBy: "admin:ldiaby"
```

This serves three purposes:

1. **Blocking.** A NOT_SAME decision prevents the same wrong match from recurring. The next time the RNE sync encounters "Thierry Cousin" from Haute-Saone, it checks the decision log first and skips the incorrect politician.

2. **Fast path.** A high-confidence SAME decision allows the resolver to return immediately without re-computing the match. This is especially valuable for sources that sync daily.

3. **Auditability.** Every match can be traced back to its evidence. When something looks wrong, we can find exactly when, how, and why the match was made, and supersede it with a corrected decision.

## Phase 2: Fellegi-Sunter Probabilistic Scoring

Phase 1 solved the architecture problem, but the scoring was still simplistic: birthdate match = 0.9, department match = 0.7, name only = 0.5. This meant "Jean-Pierre Martin" (one of France's most common names) got the same confidence as "Jean-Luc Melenchon" (essentially unique). We were treating all names as equally informative, which they clearly aren't.

### The Signal Pipeline

We expanded the resolver to evaluate **7 independent signals**, each producing a **log-likelihood ratio** (logLR): positive values support a match, negative values support a non-match.

```
                        +------------------------------+
  ResolveInput -------->|     Signal Pipeline (7)       |
  (name, date,          |                               |
   department,          |  birthdate    -- logLR --+    |
   gender, ...)         |  department   -- logLR --+    |
                        |  first-name   -- logLR --+    |
                        |  gender       -- logLR --+--> Fellegi-Sunter
  CachedPolitician ---->|  name-freq    -- logLR --+    Combiner
  (candidate from DB)   |  temporal     -- logLR --+    |
                        |  party-ctx    -- logLR --+    |
                        +------------------------------+
```

The signals:

| Signal         | What it measures                    | Typical logLR                      |
| -------------- | ----------------------------------- | ---------------------------------- |
| birthdate      | Exact or approximate date match     | +6.0 (exact), -6.0 (mismatch)      |
| department     | Mandate in same department          | +3.0                               |
| first-name     | Phonetic + fuzzy first name match   | +3.0 (exact), -5.0 (mismatch)      |
| gender         | Gender correspondence               | +1.0 (match), -6.0 (hard penalty)  |
| name-frequency | Rarity of the last name             | +6.9 (Martin) to +16.6 (Melenchon) |
| temporal       | Active mandate overlap              | +2.5 (overlap), -0.5 (old gap)     |
| party-context  | Same party mentioned in source text | +2.0                               |

### Name Frequency Weighting

This is the key innovation. Instead of treating all last names equally, the `name-frequency` signal uses the actual distribution of names across our 36,000+ politician database:

- **Rare name** (e.g. "Melenchon", frequency ~0.001%): `logLR = log2(1/0.00001) = 16.6`. A rare name match is strong evidence.
- **Common name** (e.g. "Martin", frequency ~0.8%): `logLR = log2(1/0.008) = 6.9`. A common name match is weaker evidence.

The matching also supports **fuzzy matching**: if the Jaro-Winkler score between names is >= 0.92 (e.g. "Lefebvre"/"Lefevbre"), a 20%-discounted logLR is assigned.

### The Fellegi-Sunter Combiner

The combiner sums all signal logLRs and converts to a confidence via sigmoid: `confidence = 1 / (1 + 2^(-compositeLogLR))`.

Decision thresholds are based on the composite logLR:

- **SAME**: logLR >= 12.0 (confidence >= 99.97%)
- **UNDECIDED**: logLR between 4.0 and 12.0 (human review queue)
- **NOT_SAME**: logLR < 4.0

The combiner also supports **hard penalties**: certain signals (e.g. gender mismatch) can cap the judgement to UNDECIDED or NOT_SAME regardless of the overall score.

### String Comparators for French Names

French names require specialized algorithms:

- **Jaro-Winkler**: prefix bonus, good for typographic variants
- **Damerau-Levenshtein**: edit distance with transpositions (common OCR errors)
- **Monge-Elkan**: multi-token alignment, handles compound names ("Jean-Pierre Dupont" vs "Dupont Jean Pierre")
- **French phonetic encoder**: nasal vowels, b/v ambiguity, silent final consonants (CaReFuL rule), digraphs

### Benchmark Results

We validated the engine against a corpus of **217 real French politician pairs** covering 9 difficulty categories: exact matches, birthdate disambiguation, common surnames, phonetic variants, fuzzy typos, political dynasties, compound names, marriage names, and true negatives.

| Combiner       | Precision | Recall | F1    |
| -------------- | --------- | ------ | ----- |
| Legacy         | 100%      | 36.8%  | 53.8% |
| Fellegi-Sunter | 100%      | 76.8%  | 86.9% |

The F-S combiner doubles recall while maintaining 100% precision (zero false positives).

## The poligraphId and the Reconciliation API

Each politician receives a stable public identifier: `PG-000001` through `PG-036419` (and growing). Unlike slugs (which can change with name corrections) or database IDs (which are internal), the poligraphId is designed for external use.

We also implemented the W3C Reconciliation Service API, allowing external tools to match their datasets against Poligraph:

```
GET /api/reconcile?queries={"q0":{"query":"Marine Le Pen"}}
```

This enables:

- **OpenRefine integration.** Data journalists can reconcile spreadsheets against our politician database.
- **Wikidata interop.** Our Wikibot can use the reconciliation endpoint to discover new links.
- **Partner integrations.** Other civic tech projects can verify politician identity against our data.

## Edge Case: Double Surnames Across Data Sources

Name normalization (accent removal, case folding) catches most spelling variations. But some mismatches are structural.

The mayor of Vincennes is registered in the RNE as "Charlotte Libert Albanel" (double surname). In the 2026 municipal candidatures CSV from data.gouv.fr, the same person appears as "Charlotte LIBERT" (single surname, as printed on the ballot). The RNE birthdate enrichment builds a lookup key from the normalized full name:

```
charlotte|libert albanel|94
```

The candidature lookup searches for:

```
charlotte|libert|94
```

No match. Without the birthdate enrichment, the identity resolver has less signal, and the candidate stays unlinked from her politician profile.

The fix: for multi-word surnames, also index by the primary surname (first word). "Libert Albanel" produces a fallback key on "libert", which the candidature lookup finds. To avoid false positives, two safety checks:

- **Short particles are skipped.** "De La Fontaine" does not produce a fallback on "de" (2 chars or fewer). Same for "Le Pen", "Du Bois", etc.
- **Ambiguity detection.** If two different officials would map to the same fallback key in the same department (say a "Charlotte Libert" and a "Charlotte Libert Albanel" both in dept 94), the fallback is dropped for both. Only unambiguous shortcuts are kept.

This pattern (composite names in one source, simple names in another) is common in French administrative data. The RNE uses the full legal name from the birth certificate. Electoral lists use the ballot name, which is often shorter. Marriage name vs. birth name is another frequent variant.

## Lessons Learned

**1. False positives are worse than false negatives in civic data.**

Attributing a conviction to the wrong person has legal and reputational consequences. Not finding a match is merely incomplete data. We designed the system to be conservative: when in doubt, don't match.

**2. Deterministic matching covers 80%+. Invest there first.**

Most of our politicians come from institutional sources with proper IDs (AN, Senate, HATVP). The hard cases (RNE mayors, court records, press articles) are a minority. Building robust handling for the easy 80% before tackling the fuzzy 20% was the right sequence.

**3. Store negative decisions. They're as valuable as positive ones.**

The NOT_SAME decision is arguably the most important feature. Without it, every sync run could re-create the Thierry Cousin bug. With it, a single manual intervention permanently blocks wrong matches.

**4. Not all names are created equal.**

Treating "Martin" the same as "Melenchon" in a matching score is fundamentally wrong. Name frequency weighting was the single biggest improvement to our recall. A match on a rare name is strong evidence; a match on a common name needs corroboration from other signals.

**5. Name normalization is necessary but not sufficient.**

Accent removal and case folding solve surface-level spelling variations. But structural differences between data sources (double surnames, ballot names vs. legal names, maiden names vs. married names) require dedicated handling. Each new data source brings its own naming conventions, and you'll keep discovering edge cases.

**6. Ship in phases, validate before switching.**

We rolled out the F-S combiner as a shadow-run first: legacy scoring still made all decisions while F-S results were stored in evidence for analysis. An impact analysis script re-scored all 506 existing SAME decisions with the new combiner. Only after confirming 100% agreement did we switch. This zero-risk migration path is worth the extra engineering.

## What's Next

The Identity Resolution Engine v2 is live in production with the Fellegi-Sunter combiner handling all matching decisions across 10+ data sources.

- **Wire temporal and party signals**: these signals exist but await mandate/party data in the resolver input. Once connected, they'll improve disambiguation for politicians who share names but served in different eras or different parties.
- **Bidirectional Wikidata sync**: publishing poligraphIds as Wikidata external identifiers, closing the interoperability loop.
- **Admin review UI**: a dashboard for the UNDECIDED decision queue, letting moderators confirm or reject matches with full signal visibility.

The goal is a system where every politician in Poligraph has a clear, auditable chain from source data to profile, and where mistakes like Thierry Cousin's are caught before they ever reach production.

---

_Poligraph is an open-source civic observatory tracking French politicians. The code is available on [GitHub](https://github.com/ironlam/poligraph)._
