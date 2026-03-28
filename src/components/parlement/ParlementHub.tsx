import Link from "next/link";
import { HeroSpotlight } from "@/components/votes/HeroSpotlight";
import { KeyVoteCard } from "@/components/votes/KeyVoteCard";
import { DossierCard } from "@/components/legislation";
import { CompositionHemicycle } from "./CompositionHemicycle";
import { SeoIntro } from "@/components/seo/SeoIntro";
import { FAQJsonLd } from "@/components/seo/JsonLd";
import { getFeatureValue } from "@/lib/feature-flags";
import {
  getHubStats,
  getLastScrutinDate,
  getTodayVotesByChamber,
  getKeyVotes,
} from "@/lib/data/scrutins";
import { getLatestDossiers } from "@/lib/data/legislation";
import { getGroupesListing } from "@/lib/data/groupes";
import { Info, ArrowRight, Building2, AlertTriangle, Calendar } from "lucide-react";
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
  const [hubStats, lastDate, today, keyVotes, latestDossiers, allGroups] = await Promise.all([
    getHubStats(),
    getLastScrutinDate(),
    getTodayVotesByChamber(),
    getKeyVotes(),
    getLatestDossiers(6),
    getGroupesListing(),
  ]);

  const periodOverride = await getFeatureValue<PeriodOverride>(PARLIAMENTARY_PERIOD_FLAG);
  const period = resolveParliamentaryPeriod(lastDate, periodOverride);

  const anGroups = allGroups.filter((g) => g.chamber === "AN" && g.seatCount > 0);
  const senatGroups = allGroups.filter((g) => g.chamber === "SENAT" && g.seatCount > 0);

  return (
    <div className="container mx-auto px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">Parlement</h1>
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
                citizenImpact={s.citizenImpact}
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
      </section>

      {/* Parliamentary Groups Hemicycle */}
      <CompositionHemicycle anGroups={anGroups} senatGroups={senatGroups} />

      {/* Dossiers législatifs */}
      {latestDossiers.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Dossiers législatifs</h2>
            <Link
              href="/parlement/dossiers"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Tous les dossiers <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {latestDossiers.map((d) => (
              <DossierCard
                key={d.id}
                id={d.id}
                externalId={d.externalId}
                slug={d.slug}
                title={d.title}
                shortTitle={d.shortTitle}
                number={d.number}
                status={d.status}
                category={d.category}
                theme={d.theme}
                summary={d.summary}
                filingDate={d.filingDate}
                adoptionDate={d.adoptionDate}
                amendmentCount={d._count.amendments}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
