import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HorizontalBars } from "./HorizontalBars";
import { GroupDynamics } from "./GroupDynamics";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";
import { formatDate } from "@/lib/utils";
import type {
  LegislativeStatsResult,
  ThemeDistribution,
  KeyVote,
  GroupDynamicsStats,
} from "@/services/voteStats";

interface LegislativeSectionProps {
  stats: LegislativeStatsResult;
  dynamicsAN: GroupDynamicsStats[];
  dynamicsSENAT: GroupDynamicsStats[];
}

function ThemeBars({ themes, title }: { themes: ThemeDistribution[]; title: string }) {
  if (themes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>;
  }
  const maxCount = Math.max(...themes.map((t) => t.count));
  return (
    <HorizontalBars
      title={title}
      maxValue={maxCount}
      bars={themes.slice(0, 10).map((t) => ({
        label: `${t.icon} ${t.label}`,
        value: t.count,
        suffix: " scrutins",
      }))}
    />
  );
}

function KeyVotesList({ votes }: { votes: KeyVote[] }) {
  if (votes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun scrutin disponible</p>;
  }
  return (
    <div className="divide-y">
      {votes.map((v) => (
        <div key={v.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start gap-2 mb-1.5">
            <Badge
              variant={v.result === "ADOPTED" ? "default" : "destructive"}
              className="text-[10px] py-0 px-1.5 shrink-0 mt-0.5"
            >
              {v.result === "ADOPTED" ? "Adopté" : "Rejeté"}
            </Badge>
            <Link
              href={`/parlement/votes/${v.slug || v.id}`}
              prefetch={false}
              className="text-sm font-medium hover:underline leading-snug line-clamp-2"
            >
              {capitalizeFirst(v.title)}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pl-0">
            <span>{formatDate(v.votingDate)}</span>
            {v.themeLabel && (
              <Badge variant="outline" className="text-xs py-0">
                {v.themeIcon} {v.themeLabel}
              </Badge>
            )}
            <span className="text-green-700 dark:text-green-400">{v.votesFor} pour</span>
            <span>/</span>
            <span className="text-red-700 dark:text-red-400">{v.votesAgainst} contre</span>
            <span>/</span>
            <span>{v.votesAbstain} abst.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LegislativeSection({ stats, dynamicsAN, dynamicsSENAT }: LegislativeSectionProps) {
  const { kpi, themesAN, themesSENAT, keyVotesAN, keyVotesSENAT } = stats;

  return (
    <section aria-labelledby="legislative-heading" className="py-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.scrutinsAnalyses.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Scrutins analysés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.textesAdoptes.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Textes adoptés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.dossiersEnDiscussion.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Dossiers en discussion</div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground mb-8 text-center">
        XVIIe législature · Données mises à jour quotidiennement
      </p>

      {/* Group dynamics: government alignment */}
      {(dynamicsAN.length > 0 || dynamicsSENAT.length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Rapport de forces</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Positionnement des groupes parlementaires par rapport au gouvernement
          </p>
          <GroupDynamics dynamicsAN={dynamicsAN} dynamicsSENAT={dynamicsSENAT} />
        </div>
      )}

      {/* Theme priorities */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Thèmes prioritaires</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Répartition thématique des scrutins par chambre
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Assemblée nationale</CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeBars themes={themesAN} title="Thèmes AN" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sénat</CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeBars themes={themesSENAT} title="Thèmes Sénat" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Key votes */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Votes marquants</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Scrutins récents les plus serrés entre pour et contre
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Assemblée nationale</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyVotesList votes={keyVotesAN} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sénat</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyVotesList votes={keyVotesSENAT} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Methodology */}
      <MethodologyDisclaimer>
        Données issues de l&apos;open data de l&apos;Assemblée nationale et du Sénat (XVIIe
        législature). L&apos;alignement gouvernemental mesure le pourcentage de scrutins où un
        groupe vote dans le même sens que le groupe majoritaire (EPR à l&apos;AN, RDPI au Sénat). La
        cohésion mesure l&apos;unité interne de chaque groupe. La classification thématique est
        réalisée par IA (13 catégories).
      </MethodologyDisclaimer>
    </section>
  );
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
