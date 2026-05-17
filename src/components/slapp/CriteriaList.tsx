import { Check, X } from "lucide-react";
import { SLAPP_CRITERIA, type SlappCriteriaPayload } from "@/config/slapp";

interface CriteriaListProps {
  criteria: SlappCriteriaPayload;
}

export function CriteriaList({ criteria }: CriteriaListProps) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {SLAPP_CRITERIA.map((criterion) => {
        const state = criteria[criterion.id];
        const met = state.met;
        return (
          <div
            key={criterion.id}
            className={`rounded-lg border p-3 ${
              met
                ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30"
                : "border-border bg-muted/30"
            }`}
          >
            <dt className="flex items-start gap-2 text-sm font-semibold">
              {met ? (
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
                  aria-label="Critère rencontré"
                />
              ) : (
                <X
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-label="Critère non rencontré"
                />
              )}
              <span>{criterion.label}</span>
            </dt>
            {state.note && (
              <dd className="mt-2 text-xs text-muted-foreground pl-6">{state.note}</dd>
            )}
            {criterion.id === "externalQualification" &&
              state.met &&
              criteria.externalQualification.source && (
                <dd className="mt-2 text-xs pl-6">
                  Source :{" "}
                  <a
                    href={criteria.externalQualification.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {criteria.externalQualification.qualifierName ?? "lien"}
                    <span className="sr-only"> (ouvre un nouvel onglet)</span>
                  </a>
                </dd>
              )}
          </div>
        );
      })}
    </dl>
  );
}
