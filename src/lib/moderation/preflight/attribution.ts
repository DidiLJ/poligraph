import type { AttributionAudit } from "@/types/moderation-preflight";

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface AuditAttributionInput {
  affairTitle: string;
  affairDescription: string;
  politician: {
    id: string;
    fullName: string;
    normalizedLastName: string;
  };
  otherPoliticians: Array<{
    id: string;
    fullName: string;
    normalizedLastName: string;
  }>;
}

export function auditAttribution(input: AuditAttributionInput): AttributionAudit {
  const haystack = normalize(`${input.affairTitle} ${input.affairDescription}`);
  const fullNameNormalized = normalize(input.politician.fullName);
  const lastNameNormalized = normalize(input.politician.normalizedLastName);

  if (haystack.includes(fullNameNormalized)) {
    return {
      confidence: "STRONG",
      reasoning: `Full name "${input.politician.fullName}" found in text`,
      suggestedAlternativePoliticianId: null,
    };
  }

  for (const other of input.otherPoliticians) {
    const otherFullNormalized = normalize(other.fullName);
    if (otherFullNormalized !== fullNameNormalized && haystack.includes(otherFullNormalized)) {
      return {
        confidence: "WEAK",
        reasoning: `Text mentions "${other.fullName}" but affair is attributed to "${input.politician.fullName}"`,
        suggestedAlternativePoliticianId: other.id,
      };
    }
  }

  const lastNameWithExtraChars = new RegExp(`\\b${lastNameNormalized}[a-z]{2,}\\b`);
  if (lastNameWithExtraChars.test(haystack) && !haystack.includes(lastNameNormalized + " ")) {
    return {
      confidence: "MISMATCH",
      reasoning: `Surname-like word in text but does not match "${input.politician.normalizedLastName}"`,
      suggestedAlternativePoliticianId: null,
    };
  }

  if (new RegExp(`\\b${lastNameNormalized}\\b`).test(haystack)) {
    return {
      confidence: "STRONG",
      reasoning: `Last name "${input.politician.normalizedLastName}" found in text`,
      suggestedAlternativePoliticianId: null,
    };
  }

  return {
    confidence: "WEAK",
    reasoning: `Neither full name nor last name of "${input.politician.fullName}" found in text`,
    suggestedAlternativePoliticianId: null,
  };
}
