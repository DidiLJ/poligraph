import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoligraphBadge } from "@/components/elections/PoligraphBadge";
import { CANDIDACY_STATUS_LABELS } from "@/config/labels";
import { getAccessibleTextColor } from "@/lib/contrast";
import type { CandidacyStatus } from "@/generated/prisma";

export interface CandidacyCardData {
  id: string;
  candidateName: string;
  partyLabel: string | null;
  constituencyName: string | null;
  isElected: boolean;
  round1Pct: number | null;
  round2Pct: number | null;
  status: CandidacyStatus | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  politician: { slug: string } | null;
  /**
   * `shortName` and `logoUrl` are optional so that a caller selecting only the colour keeps
   * compiling and simply renders the plain colour tile.
   */
  party: { color: string | null; shortName?: string | null; logoUrl?: string | null } | null;
}

/**
 * The party mark: a 40px tile carrying the logo, or the colour with the party initials.
 *
 * Decorative on purpose (`alt=""`, `aria-hidden` on the fallback): the party name is already
 * written next to it, so announcing it twice adds nothing for a screen reader.
 *
 * The initials are NOT hardcoded white. Two real colours of this palette are pale yellows
 * (Renaissance `#FFD600`, Place publique `#FFF100`), on which white text falls near 1.1:1;
 * `getAccessibleTextColor` picks whichever of black or white actually contrasts.
 */
function PartyMark({ party }: { party: NonNullable<CandidacyCardData["party"]> }) {
  if (party.logoUrl) {
    return (
      <Image
        src={party.logoUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border"
      />
    );
  }
  if (!party.color) return null;

  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
      style={{ backgroundColor: party.color, color: getAccessibleTextColor(party.color) }}
    >
      {party.shortName ? party.shortName.slice(0, 3) : ""}
    </span>
  );
}

export function CandidacyCard({ candidacy }: { candidacy: CandidacyCardData }) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {candidacy.party && <PartyMark party={candidacy.party} />}
          <div className="min-w-0">
            <p className="font-medium">
              {candidacy.politician ? (
                <Link
                  href={`/politiques/${candidacy.politician.slug}`}
                  className="hover:text-primary transition-colors"
                  prefetch={false}
                >
                  {candidacy.candidateName}
                </Link>
              ) : (
                candidacy.candidateName
              )}
            </p>
            {candidacy.status && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant="outline" className="text-xs font-normal">
                  {CANDIDACY_STATUS_LABELS[candidacy.status]}
                </Badge>
                {candidacy.sourceUrl && candidacy.sourceLabel && (
                  <a
                    href={candidacy.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-primary"
                  >
                    {candidacy.sourceLabel}
                  </a>
                )}
              </p>
            )}
            {candidacy.partyLabel && (
              <p className="text-sm text-muted-foreground">{candidacy.partyLabel}</p>
            )}
            {candidacy.constituencyName && (
              <p className="text-xs text-muted-foreground">{candidacy.constituencyName}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {(candidacy.round1Pct != null || candidacy.round2Pct != null) && (
              <div className="text-right text-xs">
                {candidacy.round1Pct != null && (
                  <div className="font-semibold tabular-nums">
                    T1 : {candidacy.round1Pct.toFixed(2)}%
                  </div>
                )}
                {candidacy.round2Pct != null && (
                  <div className="text-muted-foreground tabular-nums">
                    T2 : {candidacy.round2Pct.toFixed(2)}%
                  </div>
                )}
              </div>
            )}
            {candidacy.politician && <PoligraphBadge />}
            {candidacy.isElected && <Badge className="bg-green-100 text-green-800">Élu(e)</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
