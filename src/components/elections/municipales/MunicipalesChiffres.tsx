import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Vote } from "lucide-react";

interface MunicipalesChiffresProps {
  communesWithCompetition: number;
  totalCommunes: number;
  averageCompetitionIndex: number;
  parityRate: number; // 0-1
  nationalPoliticiansCandidates: number;
  round2Date?: string | null;
  resultats?: {
    communesDepouillees: number;
    participationMoyenne: number;
    eluesT1: number;
    auSecondTour: number;
  } | null;
}

function competitionColor(index: number): string {
  if (index > 1.5) return "text-green-600 dark:text-green-400";
  if (index > 1) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function parityColor(rate: number): string {
  if (rate >= 0.45) return "text-green-600 dark:text-green-400";
  if (rate >= 0.3) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function daysUntil(isoDate: string): number {
  const target = new Date(isoDate);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function MunicipalesChiffres({
  communesWithCompetition,
  totalCommunes,
  averageCompetitionIndex,
  parityRate,
  nationalPoliticiansCandidates,
  round2Date,
  resultats,
}: MunicipalesChiffresProps) {
  const competitionPct =
    totalCommunes > 0 ? ((communesWithCompetition / totalCommunes) * 100).toFixed(1) : "0";
  const daysLeft = round2Date ? daysUntil(round2Date) : null;

  return (
    <div className="space-y-6">
      {resultats && resultats.communesDepouillees > 0 && (
        <Link href="/elections/municipales-2026/resultats" prefetch={false} className="block">
          <Card className="overflow-hidden border-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white dark:from-slate-900 dark:to-slate-950 hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
                <Vote className="h-5 w-5 opacity-80" />
                <h3 className="font-bold text-base">Resultats du 1er tour</h3>
                {daysLeft != null && daysLeft > 0 && (
                  <span className="ml-auto text-xs bg-sky-500/20 text-sky-200 px-2.5 py-1 rounded-full tabular-nums">
                    2nd tour dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-around py-4 px-4 text-center">
                <div>
                  <p className="text-2xl font-extrabold tabular-nums">
                    {resultats.communesDepouillees.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">communes dépouillées</p>
                </div>
                <div className="h-10 border-l border-white/15" />
                <div>
                  <p className="text-2xl font-extrabold tabular-nums">
                    {resultats.participationMoyenne.toFixed(1)} %
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">participation moy.</p>
                </div>
                <div className="h-10 border-l border-white/15" />
                <div>
                  <p className="text-2xl font-extrabold tabular-nums text-emerald-400">
                    {resultats.eluesT1.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">élues au T1</p>
                </div>
                <div className="h-10 border-l border-white/15" />
                <div>
                  <p className="text-2xl font-extrabold tabular-nums text-sky-400">
                    {resultats.auSecondTour.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">au 2nd tour</p>
                </div>
              </div>
              <div className="bg-white/5 px-5 py-2.5 text-center">
                <span className="text-sm text-white/70">
                  Explorer les résultats par commune &rarr;
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Communes avec compétition */}
        <Card>
          <CardContent className="pt-5">
            <p className="tabular-nums text-2xl font-bold">
              {communesWithCompetition.toLocaleString("fr-FR")}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {totalCommunes.toLocaleString("fr-FR")}
              </span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">Communes avec compétition</p>
            <p className="text-xs text-muted-foreground mt-0.5">{competitionPct}%</p>
          </CardContent>
        </Card>

        {/* Indice de compétition moyen */}
        <Card>
          <CardContent className="pt-5">
            <p
              className={`tabular-nums text-2xl font-bold ${competitionColor(averageCompetitionIndex)}`}
            >
              {averageCompetitionIndex.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
              Indice de compétition moyen
              <InfoTooltip text="Rapport entre le nombre de listes déposées et le nombre attendu selon la taille de la commune. Au-dessus de 1,5 : forte compétition. En dessous de 1 : faible compétition." />
            </p>
          </CardContent>
        </Card>

        {/* Taux de parité */}
        <Card>
          <CardContent className="pt-5">
            <p className={`tabular-nums text-2xl font-bold ${parityColor(parityRate)}`}>
              {(parityRate * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">Taux de parité</p>
          </CardContent>
        </Card>

        {/* Politiciens nationaux candidats */}
        <Card>
          <CardContent className="pt-5">
            <p className="tabular-nums text-2xl font-bold">
              {nationalPoliticiansCandidates.toLocaleString("fr-FR")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Représentants nationaux candidats</p>
            <Link
              href="/elections/municipales-2026/cumul"
              prefetch={false}
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Voir les détails &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
