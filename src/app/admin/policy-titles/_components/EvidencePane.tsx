import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quoteAppearsInText } from "@/services/scrutin-policy-title/validators";
import type { EvidenceQuote, SubstanceTextBlock } from "@/services/scrutin-policy-title/types";

const TRUST_LABELS: Record<string, string> = {
  official: "Officiel",
  internal: "Interne",
  editorialContext: "Contexte éditorial",
  unknown: "Inconnu",
};

const TRUST_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  official: "default",
  internal: "secondary",
  editorialContext: "outline",
  unknown: "destructive",
};

/**
 * Renders the block text with the verbatim quote wrapped in a <mark>. Falls back
 * to plain text when the exact substring is not present (the drift banner already
 * signals that case separately).
 */
function HighlightedBlock({ text, quote }: { text: string; quote: string }) {
  const idx = text.indexOf(quote);
  if (idx < 0 || quote.length === 0) {
    return <span>{text}</span>;
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-200 px-0.5">{text.slice(idx, idx + quote.length)}</mark>
      {text.slice(idx + quote.length)}
    </>
  );
}

function findBlock(
  quote: EvidenceQuote,
  blocks: SubstanceTextBlock[]
): SubstanceTextBlock | undefined {
  return blocks.find(
    (b) =>
      b.sourceId === quote.sourceId && b.field === quote.field && b.sourceType === quote.sourceType
  );
}

export function EvidencePane({
  evidenceQuotes,
  blocks,
}: {
  evidenceQuotes: EvidenceQuote[];
  blocks: SubstanceTextBlock[];
}) {
  if (evidenceQuotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preuves citées</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aucune source citée — saisie manuelle requise.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preuves citées</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidenceQuotes.map((quote, i) => {
          const block = findBlock(quote, blocks);
          const found = block ? quoteAppearsInText(quote.quote, block.text) : false;
          const verbatim = block ? block.text.includes(quote.quote) : false;
          return (
            <div key={`${quote.sourceId}-${quote.field}-${i}`} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">
                  {quote.sourceType} · {quote.sourceId} · {quote.field}
                </span>
                {block ? (
                  <Badge variant={TRUST_VARIANT[block.trust] ?? "outline"}>
                    {TRUST_LABELS[block.trust] ?? block.trust}
                  </Badge>
                ) : null}
              </div>

              {!found ? (
                <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  ⚠ Citation introuvable dans la source actuelle
                </p>
              ) : null}

              {block ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed">
                  {verbatim ? (
                    <HighlightedBlock text={block.text} quote={quote.quote} />
                  ) : (
                    block.text
                  )}
                </p>
              ) : null}

              {!verbatim ? (
                <p className="text-xs italic text-muted-foreground">Citation : « {quote.quote} »</p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
