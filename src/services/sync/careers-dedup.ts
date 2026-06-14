import { MandateType, DataSource } from "@/generated/prisma";

export const PARLIAMENTARY_MANDATE_TYPES: MandateType[] = [
  MandateType.DEPUTE,
  MandateType.SENATEUR,
];

const AUTHORITATIVE_PARLIAMENTARY_SOURCES: DataSource[] = [
  DataSource.SENAT,
  DataSource.ASSEMBLEE_NATIONALE,
];

export interface ExistingMandateForGuard {
  type: MandateType;
  source: DataSource | null;
  startDate: Date | string | null;
  isCurrent: boolean;
}

export interface MandateCandidateForGuard {
  type: MandateType;
  startDate: Date;
  isCurrent: boolean;
}

/**
 * Whether a Wikidata mandate candidate duplicates an existing mandate and must
 * be skipped before creation.
 *
 * Parliamentary mandates (DEPUTE/SENATEUR): a politician can hold at most one
 * ACTIVE mandate of a given type — also enforced at the DB level by the
 * Mandate_current_type partial unique index — so an active candidate duplicates
 * any active same-type mandate regardless of source or start date. Authoritative
 * SENAT/AN data also always wins over Wikidata. Other types fall back to a
 * 30-day start-date tolerance.
 *
 * NOTE: this guard and the partial unique index Mandate_current_type_uq enforce
 * related but different invariants. The index is the AUTHORITATIVE guarantee: it
 * rejects any second active same-type parliamentary mandate at write time,
 * regardless of source or dates. This guard is a best-effort pre-check whose main
 * job is to skip the create so the sync does not hit that index (no P2002 noise);
 * it also defers to authoritative SENAT/AN data and a 30-day tolerance for
 * non-parliamentary types.
 */
export function isDuplicateMandateCandidate(
  existingMandates: ExistingMandateForGuard[],
  candidate: MandateCandidateForGuard
): boolean {
  const isParliamentary = PARLIAMENTARY_MANDATE_TYPES.includes(candidate.type);

  return existingMandates.some((m) => {
    if (m.type !== candidate.type) return false;

    if (isParliamentary) {
      // Two active mandates of the same type cannot coexist.
      if (candidate.isCurrent && m.isCurrent) return true;
      // Authoritative parliamentary source always wins over Wikidata.
      if (m.source && AUTHORITATIVE_PARLIAMENTARY_SOURCES.includes(m.source)) return true;
    }

    if (!m.startDate) return false;
    const existingStart = new Date(m.startDate);
    const diffDays =
      Math.abs(existingStart.getTime() - candidate.startDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < 30;
  });
}
