import { Card, CardContent } from "@/components/ui/card";
import { LEGISLATIVE_JOURNEY_STEPS } from "@/config/legislative-journey";
import { Route } from "lucide-react";

export function LegislativeJourney() {
  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <Route className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Comment lire le parcours d&apos;un texte ?
        </h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          La plupart des textes suivent ces étapes, mais toutes ne sont pas franchies : un texte
          peut être rejeté, retiré ou rester sans suite à n&apos;importe quel moment.
        </p>
        <ol className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEGISLATIVE_JOURNEY_STEPS.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="text-sm">
                <span className="font-medium">{step.label}</span>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
