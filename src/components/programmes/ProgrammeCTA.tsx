import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";

interface ProgrammeCTAProps {
  partyName: string;
  partySlug: string;
  /** External URL to the party's official programme document */
  sourceUrl?: string | null;
  /** Fallback: party website if no sourceUrl */
  partyWebsite?: string | null;
  /** Election title for context, e.g. "Élections législatives de 2024" */
  electionTitle?: string | null;
}

export function ProgrammeCTA({
  partyName,
  partySlug,
  sourceUrl,
  partyWebsite,
  electionTitle,
}: ProgrammeCTAProps) {
  const externalUrl = sourceUrl || partyWebsite;

  return (
    <div className="border rounded-lg p-5 bg-muted/30 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">Programme et positions</h3>
          <p className="text-sm text-muted-foreground">
            Découvrez les positions de {partyName} sur les grands axes thématiques
          </p>
        </div>
      </div>

      {electionTitle && (
        <p className="text-xs text-muted-foreground">
          D{"'"}après le programme des {electionTitle.toLowerCase()}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/partis/${partySlug}/programme`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Voir l{"'"}analyse
        </Link>
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            aria-label={`Programme officiel de ${partyName} (ouvre dans un nouvel onglet)`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Programme officiel
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Softer variant when party has no published platform yet.
 */
export function ProgrammeCTAEmpty({
  partyName,
  partyWebsite,
}: {
  partyName: string;
  partyWebsite?: string | null;
}) {
  return (
    <div className="border rounded-lg p-5 bg-muted/20 space-y-2">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2">
          <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-muted-foreground">Programme non encore documenté</h3>
          <p className="text-sm text-muted-foreground">
            Les positions de {partyName} ne sont pas encore renseignées sur Poligraph.
          </p>
        </div>
      </div>
      {partyWebsite && (
        <a
          href={partyWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          aria-label={`Site officiel de ${partyName} (ouvre dans un nouvel onglet)`}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Consulter le site officiel
        </a>
      )}
    </div>
  );
}
