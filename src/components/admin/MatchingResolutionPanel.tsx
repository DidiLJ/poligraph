"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BlockingDecision } from "@/lib/affairs/blocking-decisions";

interface Props {
  /** The person the affair is about. Confirming attaches the decision to them. */
  politicianId: string;
  politicianName: string;
  decisions: BlockingDecision[];
  /** Called once the last blocking decision has been settled. */
  onAllResolved?: () => void;
}

/**
 * The matching decisions that hold up a publication, resolvable in place.
 *
 * Lives on two surfaces (the affair detail page and its edit page), so it is its own
 * component rather than a branch inside the publish control.
 *
 * The press excerpt is always shown: confirming a name-only match without reading the text
 * is exactly what the guard exists to prevent, so the evidence is not behind a disclosure.
 */
export function MatchingResolutionPanel({
  politicianId,
  politicianName,
  decisions,
  onAllResolved,
}: Props) {
  const [remaining, setRemaining] = useState<BlockingDecision[]>(decisions);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(decisionId: string, action: "confirm" | "reject") {
    setResolving(decisionId);
    setError(null);
    try {
      const response = await fetch(
        action === "confirm"
          ? "/api/admin/affair-matching/confirm"
          : "/api/admin/affair-matching/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "confirm"
              ? { decisionId, chosenPoliticianId: politicianId }
              : { decisionId, action: "MOVE_TO_NO_MATCH" }
          ),
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Le rattachement n'a pas pu être traité");
        return;
      }

      const left = remaining.filter((d) => d.id !== decisionId);
      setRemaining(left);
      // Only once everything is settled: a partial resolution would just reproduce the
      // guard's refusal with one fewer decision.
      if (left.length === 0) onAllResolved?.();
    } finally {
      setResolving(null);
    }
  }

  if (remaining.length === 0) return null;

  return (
    <section
      aria-label="Rattachements à valider"
      className="w-full max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-3 text-left dark:border-amber-900/50 dark:bg-amber-950/30"
    >
      <h4 className="text-sm font-semibold">
        {remaining.length === 1
          ? "Un rattachement à valider avant publication"
          : `${remaining.length} rattachements à valider avant publication`}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Ce texte parle-t-il bien de {politicianName} ?
      </p>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {remaining.map((d) => (
          <li key={d.id} className="rounded border bg-background p-2">
            <blockquote className="text-xs leading-relaxed text-muted-foreground">
              « {d.excerpt} »
            </blockquote>

            {d.provenance === "ASSISTED" && (
              <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                Déjà confirmé par l&apos;assistance ({d.reviewedBy}) : il reste à valider ou à
                contredire.
              </p>
            )}

            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Source : </span>
              {d.sourceRef ? (
                <a
                  href={d.sourceRef}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {d.source}
                </a>
              ) : (
                d.source
              )}
            </p>

            {d.candidates.slice(0, 2).map((c) => (
              <div key={c.politicianId} className="mt-2 text-xs">
                <span className="font-medium">{c.fullName}</span>
                <span className="text-muted-foreground"> · score {c.score.toFixed(1)}</span>
                {c.supporting.length > 0 && (
                  <ul className="ml-3 list-disc text-muted-foreground">
                    {c.supporting.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                {c.opposing.length > 0 && (
                  <ul className="ml-3 list-disc text-red-700 dark:text-red-400">
                    {c.opposing.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                disabled={resolving === d.id}
                onClick={() => resolve(d.id, "confirm")}
              >
                {resolving === d.id ? "…" : `Oui, c'est ${politicianName}`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={resolving === d.id}
                onClick={() => resolve(d.id, "reject")}
              >
                Non, ce n&apos;est pas la bonne personne
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
