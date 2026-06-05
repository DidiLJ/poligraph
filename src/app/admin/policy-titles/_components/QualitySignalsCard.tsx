import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QualitySignals } from "@/services/scrutin-policy-title/types";

const DEPTH_LABELS: Record<string, string> = {
  subAmendment: "Sous-amendement",
  amendment: "Amendement",
  exposeDesMotifs: "Exposé des motifs",
};

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Badge variant={value ? "default" : "outline"}>{value ? "Oui" : "Non"}</Badge>
      </dd>
    </div>
  );
}

interface QualitySignalsWithOptional extends QualitySignals {
  parserConfidence?: number | null;
}

export function QualitySignalsCard({ signals }: { signals: QualitySignalsWithOptional }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Signaux de qualité</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <BoolRow label="Objet concret" value={signals.hasConcreteObject} />
          <BoolRow label="Action concrète" value={signals.hasConcreteAction} />

          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              Recoupement{" "}
              <span className="text-xs italic">(signal faible — recoupement lexical)</span>
            </dt>
            <dd className="font-medium">{Math.round((signals.evidenceCoverage ?? 0) * 100)} %</dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Profondeur de substance</dt>
            <dd>
              {signals.substanceDepth
                ? (DEPTH_LABELS[signals.substanceDepth] ?? signals.substanceDepth)
                : "Aucune"}
            </dd>
          </div>

          {signals.parserConfidence != null ? (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Confiance du parseur</dt>
              <dd className="font-medium">{Math.round(signals.parserConfidence * 100)} %</dd>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              Auto-confiance LLM <span className="text-xs italic">(informatif, non décisif)</span>
            </dt>
            <dd>{signals.llmSelfConfidence ?? "Aucune"}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Indicateurs de validation</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {signals.validationFlags.length === 0 ? (
                <span className="text-xs italic text-muted-foreground">Aucun</span>
              ) : (
                signals.validationFlags.map((flag) => (
                  <Badge key={flag} variant="outline" className="font-mono text-xs">
                    {flag}
                  </Badge>
                ))
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
