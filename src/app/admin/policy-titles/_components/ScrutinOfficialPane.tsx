import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ReviewAmendmentLink, ReviewScrutin } from "../_data/review-query";

const RESULT_LABELS: Record<string, string> = {
  ADOPTED: "Adopté",
  REJECTED: "Rejeté",
};

const CHAMBER_LABELS: Record<string, string> = {
  AN: "Assemblée nationale",
  SENAT: "Sénat",
};

const ROLE_LABELS: Record<string, string> = {
  SUB_AMENDMENT: "Sous-amendement",
  PARENT_AMENDMENT: "Amendement parent",
  PRINCIPAL: "Amendement principal",
  IDENTICAL: "Identique",
  INFERRED: "Inféré",
  UNKNOWN: "Inconnu",
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  SUB_AMENDMENT: "default",
  PARENT_AMENDMENT: "secondary",
  PRINCIPAL: "secondary",
  IDENTICAL: "outline",
};

export function ScrutinOfficialPane({
  scrutin,
  amendmentLinks,
}: {
  scrutin: ReviewScrutin;
  amendmentLinks: ReviewAmendmentLink[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Source officielle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Titre officiel
          </p>
          <p className="mt-1 font-medium">{scrutin.title}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Label procédural</dt>
            <dd>{scrutin.proceduralLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Date du scrutin</dt>
            <dd>{formatDate(scrutin.votingDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chambre</dt>
            <dd>{CHAMBER_LABELS[scrutin.chamber] ?? scrutin.chamber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Résultat</dt>
            <dd>{RESULT_LABELS[scrutin.result] ?? scrutin.result}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Pour : {scrutin.votesFor}</Badge>
          <Badge variant="outline">Contre : {scrutin.votesAgainst}</Badge>
          <Badge variant="outline">Abstention : {scrutin.votesAbstain}</Badge>
        </div>

        {scrutin.sourceUrl ? (
          <p>
            <a
              href={scrutin.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Voir la source sur le site officiel →
            </a>
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Aucune URL source disponible.</p>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Amendements liés
          </p>
          {amendmentLinks.length === 0 ? (
            <p className="mt-1 text-xs italic text-muted-foreground">Aucun amendement lié.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {amendmentLinks.map((link) => (
                <li key={link.amendmentId} className="flex items-center gap-2">
                  <Badge variant={ROLE_VARIANT[link.role] ?? "outline"}>
                    {ROLE_LABELS[link.role] ?? link.role}
                  </Badge>
                  <span className="font-mono text-xs">n° {link.number}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
