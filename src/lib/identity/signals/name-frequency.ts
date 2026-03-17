import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import {
  NAME_FREQ_LOG_LR_CAP,
  NAME_FREQ_FUZZY_DISCOUNT,
  NAME_FREQ_FUZZY_THRESHOLD,
} from "./constants";
import { JaroWinklerComparator } from "../comparators/jaro-winkler";

const jw = new JaroWinklerComparator();

export class NameFrequencySignal implements SignalEvaluator {
  readonly id = "name-frequency";
  readonly description = "Last name frequency-weighted scoring (Fellegi-Sunter)";
  readonly tier = SignalTier.MODERATE;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    context: SignalScoringContext
  ): SignalResult {
    if (!context.nameFrequency) {
      return this.neutral("No frequency data available");
    }

    const normalizer = context.adapter.normalizer;
    const inputName = normalizer.normalizeLastName(input.lastName);
    const candidateName = normalizer.normalizeLastName(candidate.lastName);

    // Check exact match
    if (inputName === candidateName) {
      const freq = this.getFrequency(candidateName, context);
      const logLR = Math.min(Math.log2(1.0 / freq), NAME_FREQ_LOG_LR_CAP);
      return {
        signalId: this.id,
        logLikelihoodRatio: logLR,
        deterministic: false,
        explanation: `Exact name match "${candidateName}" (freq=${freq.toFixed(6)}, logLR=${logLR.toFixed(1)})`,
        method: MatchMethod.NAME_ONLY,
      };
    }

    // Check fuzzy match
    const jwScore = jw.compare(inputName, candidateName);
    if (jwScore >= NAME_FREQ_FUZZY_THRESHOLD) {
      const freq = this.getFrequency(candidateName, context);
      const logLR = Math.min(
        Math.log2(jwScore / freq) * NAME_FREQ_FUZZY_DISCOUNT,
        NAME_FREQ_LOG_LR_CAP
      );
      return {
        signalId: this.id,
        logLikelihoodRatio: logLR,
        deterministic: false,
        explanation: `Fuzzy name match "${inputName}"~"${candidateName}" (jw=${jwScore.toFixed(3)}, freq=${freq.toFixed(6)})`,
        method: MatchMethod.FUZZY_NAME,
      };
    }

    return this.neutral(`No name match: "${inputName}" vs "${candidateName}"`);
  }

  private getFrequency(name: string, context: SignalScoringContext): number {
    const raw = context.nameFrequency!.get(name);
    if (raw !== undefined) return raw;
    const total = context.totalRecords ?? 1;
    const unique = context.uniqueNames ?? 1;
    return 1 / (total + unique);
  }

  private neutral(explanation: string): SignalResult {
    return {
      signalId: this.id,
      logLikelihoodRatio: 0,
      deterministic: false,
      explanation,
      method: MatchMethod.NAME_ONLY,
    };
  }
}
