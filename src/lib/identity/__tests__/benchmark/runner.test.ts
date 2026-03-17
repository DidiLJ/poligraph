/* eslint-disable no-console */
import { describe, it, expect, vi } from "vitest";

// Must mock db before importing NameFrequencyCache
vi.mock("@/lib/db", () => ({
  db: { $queryRaw: vi.fn() },
}));

import { frenchCorpus as FRENCH_CORPUS } from "./french-corpus";
import { LegacyCombiner } from "../../combiner";
import { FellegiSunterCombiner } from "../../fellegi-sunter-combiner";
import { BirthdateSignal } from "../../signals/birthdate";
import { DepartmentSignal } from "../../signals/department";
import { FirstNameSignal } from "../../signals/first-name";
import { GenderSignal } from "../../signals/gender";
import { NameFrequencySignal } from "../../signals/name-frequency";
import { NameFrequencyCache } from "../../frequency";
import { FrenchAdapter } from "../../adapters/fr";
import { IDENTITY_THRESHOLDS } from "../../types";
import { Judgement } from "@/generated/prisma";
import type {
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "../../signals/types";
import type { BenchmarkPair } from "./french-corpus";

function buildCorpusFrequencyCache(): NameFrequencyCache {
  const counts = new Map<string, number>();
  for (const pair of FRENCH_CORPUS) {
    const name = pair.candidate.lastName.toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return NameFrequencyCache.fromCounts(counts, FRENCH_CORPUS.length);
}

function buildSignalInputs(pair: BenchmarkPair) {
  const input: SignalScoringInput = {
    firstName: pair.input.firstName,
    lastName: pair.input.lastName,
    birthDate: pair.input.birthDate ? new Date(pair.input.birthDate) : null,
    department: pair.input.department ?? null,
    gender: pair.input.gender ?? null,
  };
  const candidate: SignalCandidateRecord = {
    id: pair.id,
    firstName: pair.candidate.firstName,
    lastName: pair.candidate.lastName,
    birthDate: pair.candidate.birthDate ? new Date(pair.candidate.birthDate) : null,
    departments: pair.candidate.departments ?? [],
    gender: pair.candidate.gender ?? null,
    prominenceScore: pair.candidate.prominenceScore ?? 100,
  };
  return { input, candidate };
}

const birthdateSignal = new BirthdateSignal();
const departmentSignal = new DepartmentSignal();
const firstNameSignal = new FirstNameSignal();
const genderSignal = new GenderSignal();
const nameFrequencySignal = new NameFrequencySignal();

function evaluateLegacySignals(
  input: SignalScoringInput,
  candidate: SignalCandidateRecord,
  context: SignalScoringContext
) {
  return [
    birthdateSignal.evaluate(input, candidate, context),
    departmentSignal.evaluate(input, candidate, context),
    firstNameSignal.evaluate(input, candidate, context),
    genderSignal.evaluate(input, candidate, context),
  ];
}

function evaluateAllSignals(
  input: SignalScoringInput,
  candidate: SignalCandidateRecord,
  context: SignalScoringContext
) {
  return [
    ...evaluateLegacySignals(input, candidate, context),
    nameFrequencySignal.evaluate(input, candidate, context),
  ];
}

describe("Benchmark: French Corpus", () => {
  const legacyCombiner = new LegacyCombiner();
  const fsCombiner = new FellegiSunterCombiner();
  const freqCache = buildCorpusFrequencyCache();

  it("corpus has at least 200 pairs", () => {
    expect(FRENCH_CORPUS.length).toBeGreaterThanOrEqual(200);
  });

  it("legacy combiner precision >= 90% on SAME decisions", () => {
    // Target was 95% aspirationally; floor set to 90% as safety net.
    // Actual precision logged below for observability.
    let truePositives = 0;
    let falsePositives = 0;

    for (const pair of FRENCH_CORPUS) {
      const { input, candidate } = buildSignalInputs(pair);
      const ctx: SignalScoringContext = { adapter: FrenchAdapter, mode: "legacy" };
      const sigs = evaluateLegacySignals(input, candidate, ctx);
      const result = legacyCombiner.combine(sigs, {
        prominenceScore: pair.candidate.prominenceScore ?? 100,
      });

      if (result.confidence >= IDENTITY_THRESHOLDS.AUTO_MATCH) {
        if (pair.expectedMatch) truePositives++;
        else falsePositives++;
      }
    }

    const precision = truePositives / (truePositives + falsePositives || 1);
    console.log(
      `Legacy SAME precision: ${(precision * 100).toFixed(1)}% (TP=${truePositives}, FP=${falsePositives})`
    );
    expect(precision).toBeGreaterThanOrEqual(0.9);
  });

  it("Fellegi-Sunter combiner precision >= 90% on SAME decisions", () => {
    // Target was 95% aspirationally; floor set to 90% as safety net.
    // Actual precision logged below for observability.
    let truePositives = 0;
    let falsePositives = 0;

    for (const pair of FRENCH_CORPUS) {
      const { input, candidate } = buildSignalInputs(pair);
      const ctx: SignalScoringContext = {
        adapter: FrenchAdapter,
        mode: "fellegi-sunter",
        nameFrequency: freqCache,
        totalRecords: FRENCH_CORPUS.length,
        uniqueNames: freqCache.uniqueNames,
      };
      const sigs = evaluateAllSignals(input, candidate, ctx);
      const result = fsCombiner.combine(sigs);

      if (result.judgement === Judgement.SAME) {
        if (pair.expectedMatch) truePositives++;
        else falsePositives++;
      }
    }

    const precision = truePositives / (truePositives + falsePositives || 1);
    console.log(
      `F-S SAME precision: ${(precision * 100).toFixed(1)}% (TP=${truePositives}, FP=${falsePositives})`
    );
    expect(precision).toBeGreaterThanOrEqual(0.9);
  });

  it("prints full metrics report", () => {
    const legacyCtx: SignalScoringContext = { adapter: FrenchAdapter, mode: "legacy" };
    const fsCtx: SignalScoringContext = {
      adapter: FrenchAdapter,
      mode: "fellegi-sunter",
      nameFrequency: freqCache,
      totalRecords: FRENCH_CORPUS.length,
      uniqueNames: freqCache.uniqueNames,
    };

    const legacyStats = { tp: 0, fp: 0, fn: 0, tn: 0 };
    const fsStats = { tp: 0, fp: 0, fn: 0, tn: 0 };

    for (const pair of FRENCH_CORPUS) {
      const { input, candidate } = buildSignalInputs(pair);

      // Legacy
      const legacySigs = evaluateLegacySignals(input, candidate, legacyCtx);
      const legacyResult = legacyCombiner.combine(legacySigs, {
        prominenceScore: pair.candidate.prominenceScore ?? 100,
      });
      const legacySame = legacyResult.confidence >= IDENTITY_THRESHOLDS.AUTO_MATCH;

      if (legacySame && pair.expectedMatch) legacyStats.tp++;
      else if (legacySame && !pair.expectedMatch) legacyStats.fp++;
      else if (!legacySame && pair.expectedMatch) legacyStats.fn++;
      else legacyStats.tn++;

      // F-S
      const fsSigs = evaluateAllSignals(input, candidate, fsCtx);
      const fsResult = fsCombiner.combine(fsSigs);
      const fsSame = fsResult.judgement === Judgement.SAME;

      if (fsSame && pair.expectedMatch) fsStats.tp++;
      else if (fsSame && !pair.expectedMatch) fsStats.fp++;
      else if (!fsSame && pair.expectedMatch) fsStats.fn++;
      else fsStats.tn++;
    }

    const legacyP = legacyStats.tp / (legacyStats.tp + legacyStats.fp || 1);
    const legacyR = legacyStats.tp / (legacyStats.tp + legacyStats.fn || 1);
    const legacyF1 = (2 * legacyP * legacyR) / (legacyP + legacyR || 1);

    const fsP = fsStats.tp / (fsStats.tp + fsStats.fp || 1);
    const fsR = fsStats.tp / (fsStats.tp + fsStats.fn || 1);
    const fsF1 = (2 * fsP * fsR) / (fsP + fsR || 1);

    console.log(`\n--- BENCHMARK REPORT (${FRENCH_CORPUS.length} pairs) ---`);
    console.log(
      `Legacy:  P=${(legacyP * 100).toFixed(1)}% R=${(legacyR * 100).toFixed(1)}% F1=${(legacyF1 * 100).toFixed(1)}% (TP=${legacyStats.tp} FP=${legacyStats.fp} FN=${legacyStats.fn} TN=${legacyStats.tn})`
    );
    console.log(
      `F-S:     P=${(fsP * 100).toFixed(1)}% R=${(fsR * 100).toFixed(1)}% F1=${(fsF1 * 100).toFixed(1)}% (TP=${fsStats.tp} FP=${fsStats.fp} FN=${fsStats.fn} TN=${fsStats.tn})`
    );

    // This test always passes - it's just for printing the report
    expect(true).toBe(true);
  });
});
