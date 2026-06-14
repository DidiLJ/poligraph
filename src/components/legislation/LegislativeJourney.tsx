import { Card, CardContent } from "@/components/ui/card";
import { Route } from "lucide-react";

// Plain-language steps of the French legislative procedure. Copy lives in a data
// array (not JSX) so apostrophes stay unescaped and the markup stays compact.
const JOURNEY_STEPS: { label: string; description: string }[] = [
  {
    label: "Dépôt",
    description: "Le texte est enregistré au Parlement, mais pas forcément examiné.",
  },
  {
    label: "Commission",
    description: "Les députés ou sénateurs étudient et amendent le texte avant le débat.",
  },
  {
    label: "Séance publique",
    description: "Le texte est débattu puis voté en public dans l'hémicycle.",
  },
  {
    label: "Navette",
    description: "L'Assemblée et le Sénat s'échangent le texte pour aboutir à une version commune.",
  },
  {
    label: "Adoption définitive",
    description:
      "Le Parlement a terminé l'examen, parfois après une commission mixte paritaire (CMP).",
  },
  {
    label: "Conseil constitutionnel & promulgation",
    description:
      "Contrôle éventuel, puis publication au Journal officiel : le texte entre en vigueur.",
  },
];

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
          {JOURNEY_STEPS.map((step, i) => (
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
