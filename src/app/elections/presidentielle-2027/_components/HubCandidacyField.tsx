import { CandidacyCard, type CandidacyCardData } from "@/components/elections/CandidacyCard";
import type { HubCandidacy } from "@/lib/data/hub";

/**
 * The whole field, not the published fiches: every sourced candidacy, pressenti/envisagé
 * included. `constituencyName`/`isElected`/`round1Pct`/`round2Pct` have no meaning before a
 * first round exists, so they map to their neutral values rather than to a guess.
 */
function toCandidacyCardData(candidacy: HubCandidacy): CandidacyCardData {
  return {
    id: candidacy.id,
    candidateName: candidacy.candidateName,
    partyLabel: candidacy.partyLabel,
    constituencyName: null,
    isElected: false,
    round1Pct: null,
    round2Pct: null,
    status: candidacy.status,
    sourceUrl: candidacy.sourceUrl,
    sourceLabel: candidacy.sourceLabel,
    politician: candidacy.politicianSlug !== null ? { slug: candidacy.politicianSlug } : null,
    // Null when the candidacy is not linked to a party entity: the card then renders no mark at
    // all rather than a grey placeholder that would look like a party we failed to identify.
    party:
      candidacy.partyColor !== null || candidacy.partyLogoUrl !== null
        ? {
            color: candidacy.partyColor,
            shortName: candidacy.partyShortName,
            logoUrl: candidacy.partyLogoUrl,
          }
        : null,
  };
}

export function HubCandidacyField({ candidacies }: { candidacies: HubCandidacy[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Candidatures classées par ordre alphabétique du nom.
      </p>
      <div className="space-y-2">
        {candidacies.map((candidacy) => (
          <CandidacyCard key={candidacy.id} candidacy={toCandidacyCardData(candidacy)} />
        ))}
      </div>
    </div>
  );
}
