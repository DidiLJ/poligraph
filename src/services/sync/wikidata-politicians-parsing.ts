/**
 * Pure parsing functions for Wikidata SPARQL politician bindings.
 * Extracted to avoid DB dependency in tests.
 */

const IS_CURRENT_THRESHOLD = 2020;
const FEMALE_QID = "Q6581072";

// --- Types ---

export interface SparqlPoliticianBinding {
  person: { value: string };
  personLabel: { value: string };
  position: { value: string };
  startDate?: { value: string };
  endDate?: { value: string };
  birthDate?: { value: string };
  gender?: { value: string };
}

export interface ParsedMandate {
  positionQid: string;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
}

export interface ParsedPolitician {
  wikidataId: string;
  firstName: string;
  lastName: string;
  civility: string;
  birthDate: Date | null;
  mandates: ParsedMandate[];
}

// --- Pure functions ---

export function determineIsCurrent(
  startDateStr: string | undefined,
  endDateStr: string | undefined
): boolean {
  if (endDateStr) return false;
  if (!startDateStr) return false;
  const year = new Date(startDateStr).getFullYear();
  return year >= IS_CURRENT_THRESHOLD;
}

export function extractQid(entityUrl: string): string {
  return entityUrl.replace("http://www.wikidata.org/entity/", "");
}

function splitName(fullLabel: string): { firstName: string; lastName: string } {
  const parts = fullLabel.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0]! };
  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1]!;
  return { firstName, lastName };
}

export function parseDateStr(str: string | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function parseSparqlBindings(bindings: SparqlPoliticianBinding[]): ParsedPolitician[] {
  const byQid = new Map<string, ParsedPolitician>();

  for (const b of bindings) {
    const qid = extractQid(b.person.value);
    const posQid = extractQid(b.position.value);

    if (!byQid.has(qid)) {
      const { firstName, lastName } = splitName(b.personLabel.value);
      const genderQid = b.gender?.value ? extractQid(b.gender.value) : null;
      byQid.set(qid, {
        wikidataId: qid,
        firstName,
        lastName,
        civility: genderQid === FEMALE_QID ? "Mme" : "M.",
        birthDate: parseDateStr(b.birthDate?.value),
        mandates: [],
      });
    }

    const person = byQid.get(qid)!;

    if (!person.birthDate && b.birthDate?.value) {
      person.birthDate = parseDateStr(b.birthDate.value);
    }
    if (person.civility === "M." && b.gender?.value) {
      const genderQid = extractQid(b.gender.value);
      if (genderQid === FEMALE_QID) person.civility = "Mme";
    }

    person.mandates.push({
      positionQid: posQid,
      startDate: parseDateStr(b.startDate?.value),
      endDate: parseDateStr(b.endDate?.value),
      isCurrent: determineIsCurrent(b.startDate?.value, b.endDate?.value),
    });
  }

  return Array.from(byQid.values());
}
