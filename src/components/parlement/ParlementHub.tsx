import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VoteCard } from "@/components/votes";
import { HeroSpotlight } from "@/components/votes/HeroSpotlight";
import { KeyVoteCard } from "@/components/votes/KeyVoteCard";
import { ParlementSearch } from "./ParlementSearch";
import { SeoIntro } from "@/components/seo/SeoIntro";
import { FAQJsonLd } from "@/components/seo/JsonLd";
import {
  THEME_CATEGORY_LABELS,
  THEME_CATEGORY_ICONS,
  THEME_CATEGORY_COLORS,
  CHAMBER_LABELS,
} from "@/config/labels";
import { themeToSlug } from "@/lib/theme-utils";
import { isFeatureEnabled, getFeatureValue } from "@/lib/feature-flags";
import {
  getHubStats,
  getLastScrutinDate,
  getTodayVotesByChamber,
  getThemeCountsWithKeyVotes,
  getChamberAdoptionRates,
  getLatestScrutins,
  getKeyVotes,
} from "@/lib/data/scrutins";
import { Info, ArrowRight, Search, Building2, AlertTriangle, Calendar } from "lucide-react";
import {
  resolveParliamentaryPeriod,
  PARLIAMENTARY_PERIOD_FLAG,
  type PeriodOverride,
  type ParliamentaryPeriodType,
} from "@/config/parliamentary-calendar";

const PERIOD_STYLES: Record<
  ParliamentaryPeriodType,
  { bg: string; border: string; text: string; icon: string }
> = {
  dissolution: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  electoral: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  intersession: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    icon: "text-primary",
  },
  extraordinary: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    icon: "text-primary",
  },
  recess: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    icon: "text-primary",
  },
};

function getPeriodIcon(type: ParliamentaryPeriodType) {
  if (type === "dissolution" || type === "electoral") {
    return AlertTriangle;
  }
  if (type === "intersession") {
    return Calendar;
  }
  return Info;
}

export async function ParlementHub() {
  const [hubStats, lastDate, today, themeCounts, chamberRates, latestScrutins, keyVotes] =
    await Promise.all([
      getHubStats(),
      getLastScrutinDate(),
      getTodayVotesByChamber(),
      getThemeCountsWithKeyVotes(),
      getChamberAdoptionRates(),
      getLatestScrutins(),
      getKeyVotes(),
    ]);

  const [showAssemblee, periodOverride] = await Promise.all([
    isFeatureEnabled("ASSEMBLEE_SECTION"),
    getFeatureValue<PeriodOverride>(PARLIAMENTARY_PERIOD_FLAG),
  ]);
  const period = resolveParliamentaryPeriod(lastDate, periodOverride);

  const anStats = chamberRates.find((c) => c.chamber === "AN");
  const senatStats = chamberRates.find((c) => c.chamber === "SENAT");

  return (
    <div className="container mx-auto px-4 py-8">
      <FAQJsonLd
        questions={[
          {
            question: "Comment fonctionne le Parlement français ?",
            answer:
              "Le Parlement français est composé de deux chambres : l'Assemblée nationale (577 députés élus au suffrage universel direct) et le Sénat (348 sénateurs élus au suffrage indirect). Ensemble, ils votent les lois et contrôlent l'action du gouvernement.",
          },
          {
            question: "Comment suivre les votes parlementaires ?",
            answer: `Poligraph recense ${hubStats.totalScrutins.toLocaleString("fr-FR")} scrutins et ${hubStats.totalDossiers.toLocaleString("fr-FR")} dossiers législatifs. Vous pouvez explorer les votes par thème, par chambre, ou rechercher un scrutin par mot-clé.`,
          },
        ]}
      />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">Parlement</h1>
        <p className="text-sm text-muted-foreground">
          {hubStats.totalScrutins.toLocaleString("fr-FR")} scrutins,{" "}
          {hubStats.totalDossiers.toLocaleString("fr-FR")} dossiers suivis
        </p>
        <div className="sr-only">
          <SeoIntro
            text={`Portail parlementaire : ${hubStats.totalScrutins.toLocaleString("fr-FR")} scrutins de l'Assemblée nationale et du Sénat, ${hubStats.totalDossiers.toLocaleString("fr-FR")} dossiers législatifs suivis.`}
          />
        </div>
      </div>

      {/* Parliamentary period banner */}
      {period &&
        (() => {
          const style = PERIOD_STYLES[period.type];
          const Icon = getPeriodIcon(period.type);
          return (
            <div
              className={`flex items-start gap-3 mb-8 px-4 py-3 ${style.bg} border ${style.border} rounded-lg`}
            >
              <Icon className={`h-5 w-5 ${style.icon} mt-0.5 shrink-0`} />
              <p className={`text-sm ${style.text}`}>{period.message}</p>
            </div>
          );
        })()}

      {/* Hero Spotlight */}
      {keyVotes.hero && (
        <section className="mb-8" aria-label="Vote clé de la semaine">
          <HeroSpotlight
            id={keyVotes.hero.id}
            slug={keyVotes.hero.slug}
            title={keyVotes.hero.title}
            votingDate={keyVotes.hero.votingDate}
            votesFor={keyVotes.hero.votesFor}
            votesAgainst={keyVotes.hero.votesAgainst}
            votesAbstain={keyVotes.hero.votesAbstain}
            result={keyVotes.hero.result}
            theme={keyVotes.hero.theme}
            summary={keyVotes.hero.summary}
            citizenImpact={keyVotes.hero.citizenImpact}
          />
        </section>
      )}

      {/* Key Votes Grid */}
      {keyVotes.grid.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Votes clés récents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {keyVotes.grid.map((s) => (
              <KeyVoteCard
                key={s.id}
                id={s.id}
                slug={s.slug}
                title={s.title}
                votingDate={s.votingDate}
                votesFor={s.votesFor}
                votesAgainst={s.votesAgainst}
                votesAbstain={s.votesAbstain}
                result={s.result}
                theme={s.theme}
                summary={s.summary}
                isKeyVote
              />
            ))}
          </div>
        </section>
      )}

      {/* Aujourd'hui au Parlement */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Aujourd{"'"}hui au Parlement</h2>
        {today.total > 0 ? (
          <Link
            href="/parlement/votes/aujourd-hui"
            className="block p-4 bg-muted/50 rounded-lg border hover:bg-muted/80 transition-colors"
          >
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  <Building2 className="h-3 w-3" />
                  AN
                </span>
                <span className="font-semibold">
                  {today.AN} scrutin{today.AN > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700">
                  <Building2 className="h-3 w-3" />
                  Sénat
                </span>
                <span className="font-semibold">
                  {today.SENAT} scrutin{today.SENAT > 1 ? "s" : ""}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Pas de scrutin aujourd{"'"}hui</p>
        )}
        {showAssemblee && (
          <Link
            href="/parlement/dossiers"
            className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
          >
            Dossiers législatifs récemment mis à jour
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </section>

      {/* Explorer par thème */}
      {themeCounts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Explorer par thème</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Les scrutins sont classés par thème pour faciliter la recherche
          </p>
          <div className="flex flex-wrap gap-2">
            {themeCounts.map((t) => (
              <Link
                key={t.theme}
                href={`/parlement/votes/themes/${themeToSlug(t.theme)}`}
                prefetch={false}
              >
                <Badge
                  variant="outline"
                  className={`cursor-pointer hover:opacity-80 transition-opacity ${THEME_CATEGORY_COLORS[t.theme]}`}
                >
                  {THEME_CATEGORY_ICONS[t.theme]} {THEME_CATEGORY_LABELS[t.theme]}
                  {t.keyVotes > 0 && <span className="ml-1 font-bold">{t.keyVotes} clés</span>} (
                  {t.total})
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* AN / Sénat cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                <Building2 className="h-3.5 w-3.5" />
                {CHAMBER_LABELS.AN}
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              577 députés élus au suffrage universel direct
            </p>
            {anStats && (
              <div className="flex items-baseline gap-4 mb-4">
                <div>
                  <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {anStats.total.toLocaleString("fr-FR")}
                  </span>
                  <span className="text-xs text-primary ml-1">scrutins</span>
                </div>
                <div>
                  <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {anStats.adoptionRate}%
                  </span>
                  <span className="text-xs text-primary ml-1">adoptés</span>
                </div>
              </div>
            )}
            <Link
              href="/parlement?chamber=AN"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
            >
              Voir les scrutins <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-rose-100 text-rose-700">
                <Building2 className="h-3.5 w-3.5" />
                {CHAMBER_LABELS.SENAT}
              </span>
            </div>
            <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">
              348 sénateurs élus au suffrage indirect
            </p>
            {senatStats && (
              <div className="flex items-baseline gap-4 mb-4">
                <div>
                  <span className="text-2xl font-bold text-rose-900 dark:text-rose-100">
                    {senatStats.total.toLocaleString("fr-FR")}
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 ml-1">scrutins</span>
                </div>
                <div>
                  <span className="text-lg font-semibold text-rose-900 dark:text-rose-100">
                    {senatStats.adoptionRate}%
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 ml-1">adoptés</span>
                </div>
              </div>
            )}
            <Link
              href="/parlement?chamber=SENAT"
              className="inline-flex items-center gap-1 text-sm font-medium text-rose-700 dark:text-rose-300 hover:underline"
            >
              Voir les scrutins <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Groupes parlementaires */}
      <section className="mb-8">
        <Link
          href="/parlement/groupes"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          Groupes parlementaires
          <ArrowRight className="h-3 w-3" />
        </Link>
      </section>

      {/* Search */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Search className="h-5 w-5" />
          Rechercher un scrutin
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Recherchez par sujet, thème ou mot-clé dans les résumés et impacts citoyens
        </p>
        <ParlementSearch />
      </section>

      {/* Latest scrutins */}
      {latestScrutins.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Derniers scrutins</h2>
            <Link
              href="/parlement?page=1"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Voir tous les scrutins <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {latestScrutins.map((s) => (
              <VoteCard
                key={s.id}
                id={s.id}
                externalId={s.externalId}
                slug={s.slug}
                title={s.title}
                votingDate={s.votingDate}
                legislature={s.legislature}
                chamber={s.chamber}
                votesFor={s.votesFor}
                votesAgainst={s.votesAgainst}
                votesAbstain={s.votesAbstain}
                result={s.result}
                sourceUrl={s.sourceUrl}
                theme={s.theme}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pedagogy */}
      <details className="mb-8 bg-muted/50 rounded-lg border">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium hover:bg-muted/80 rounded-lg transition-colors">
          Comment fonctionne le Parlement ?
        </summary>
        <div className="px-4 pb-4 pt-2 text-sm text-muted-foreground space-y-2">
          <p>
            Le Parlement français est composé de deux chambres : l{"'"}Assemblée nationale (577
            députés) et le Sénat (348 sénateurs). Ensemble, ils votent les lois et contrôlent l{"'"}
            action du gouvernement.
          </p>
          <p className="font-medium">Parcours d{"'"}un texte de loi :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>
              <strong>Dépôt</strong> : un projet (gouvernement) ou une proposition (parlementaire)
              est déposé
            </li>
            <li>
              <strong>Commission</strong> : examen en commission spécialisée, amendements
            </li>
            <li>
              <strong>Hémicycle</strong> : débat et vote en séance publique
            </li>
            <li>
              <strong>Navette</strong> : le texte fait la navette entre les deux chambres jusqu{"'"}
              à accord
            </li>
            <li>
              <strong>Promulgation</strong> : le Président de la République promulgue la loi
            </li>
          </ol>
        </div>
      </details>
    </div>
  );
}
