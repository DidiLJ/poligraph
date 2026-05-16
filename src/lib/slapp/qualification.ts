import type { SlappCriteriaPayload, QualificationRule } from "@/config/slapp";

export type QualificationResult = {
  qualified: boolean;
  rule: QualificationRule | null;
  metCount: number;
};

function isExternalQualificationDocumented(
  payload: SlappCriteriaPayload["externalQualification"]
): boolean {
  if (!payload.met) return false;
  if (!payload.source || payload.source.trim().length === 0) return false;
  if (!payload.qualifierName || payload.qualifierName.trim().length === 0) return false;
  return true;
}

export function evaluateQualification(criteria: SlappCriteriaPayload): QualificationResult {
  const metCount = [
    criteria.asymmetry.met,
    criteria.publicInterest.met,
    criteria.disproportion.met,
    criteria.outcomeUnfavorable.met,
    criteria.externalQualification.met,
  ].filter(Boolean).length;

  const externalDocumented = isExternalQualificationDocumented(criteria.externalQualification);

  if (metCount >= 3) {
    return { qualified: true, rule: "3of5", metCount };
  }

  if (metCount === 1 && externalDocumented) {
    return { qualified: true, rule: "criterion5_only", metCount };
  }

  return { qualified: false, rule: null, metCount };
}

export function isQualified(criteria: SlappCriteriaPayload): boolean {
  return evaluateQualification(criteria).qualified;
}
