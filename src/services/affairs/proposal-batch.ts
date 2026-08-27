import { parseAffairProposalPayload } from "@/lib/security/schemas/affair-proposal";

export interface ProposalBatchCandidate {
  id: string;
  proposedPatch: unknown;
}

/** Keeps HIGH-risk event additions out of every generic multi-ID acceptance. */
export function selectProposalIdsForBatch(
  requestedIds: readonly string[],
  candidates: readonly ProposalBatchCandidate[],
  includeEvents: boolean
): { acceptedIds: string[]; excludedEventIds: string[] } {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const excludedEventIds = includeEvents
    ? []
    : requestedIds.filter((id) => {
        const candidate = byId.get(id);
        if (!candidate) return false;
        try {
          return parseAffairProposalPayload(candidate.proposedPatch).kind === "ADD_EVENT";
        } catch {
          return false;
        }
      });
  const excluded = new Set(excludedEventIds);
  return {
    acceptedIds: requestedIds.filter((id) => !excluded.has(id)),
    excludedEventIds,
  };
}
