import { Badge } from "@/components/ui/badge";
import type { Chip, PublicTitleView } from "@/lib/votes/resolve-public-title";
import type { VotingResult } from "@/generated/prisma";

interface VoteTitleDisplayProps {
  view: PublicTitleView;
  variant: "card" | "detail" | "preview";
  /** Host cards already render date/result chrome, so they pass false to avoid
   *  duplicating the chip row. Default true (detail/preview show chips). */
  showChips?: boolean;
  /** The "Titre officiel" disclosure (policy mode only). Default true. */
  showOfficialDisclosure?: boolean;
}

function resultLabel(result: VotingResult): string {
  return result === "ADOPTED" ? "Adopté" : "Rejeté";
}

function ChipRow({ chips }: { chips: Chip[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {chips.map((chip, index) => {
        if (chip.kind === "procedural") {
          return (
            <li key={`procedural-${index}`}>
              <Badge variant="outline">{chip.label}</Badge>
            </li>
          );
        }
        if (chip.kind === "result") {
          return (
            <li key={`result-${index}`}>
              <Badge variant={chip.result === "ADOPTED" ? "default" : "destructive"}>
                {resultLabel(chip.result)}
              </Badge>
            </li>
          );
        }
        return (
          <li key={`date-${index}`}>
            <Badge variant="secondary">{new Date(chip.iso).toLocaleDateString("fr-FR")}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

export function VoteTitleDisplay({
  view,
  variant,
  showChips = true,
  showOfficialDisclosure = true,
}: VoteTitleDisplayProps) {
  if (view.mode === "policy") {
    return (
      <div data-variant={variant} data-mode="policy">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{view.policyTitle}</h3>
          <Badge variant="accent">Titre explicatif</Badge>
        </div>
        {view.policySubtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{view.policySubtitle}</p>
        ) : null}
        {showChips ? <ChipRow chips={view.chips} /> : null}
        {showOfficialDisclosure ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Titre officiel</summary>
            <p className="mt-1">{view.officialTitle}</p>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div data-variant={variant} data-mode="official">
      <h3 className="font-semibold">{view.officialTitle}</h3>
      {showChips ? <ChipRow chips={view.chips} /> : null}
    </div>
  );
}
