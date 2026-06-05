import Link from "next/link";
import { VoteCard } from "./VoteCard";
import { DateNavigation } from "./DateNavigation";
import { ScrutinTypeTabs } from "./ScrutinTypeTabs";
import { CollectionPageJsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getScrutinsByDate, getAdjacentVoteDates } from "@/lib/data/scrutins";
import { CHAMBER_LABELS } from "@/config/labels";
import { SITE_URL } from "@/config/site";
import { formatDateFrUTC } from "@/lib/utils";
import { Vote, CheckCircle, XCircle, Building2, ArrowRight, Sparkles } from "lucide-react";
import type { Chamber } from "@/generated/prisma";
import type { DailyScrutin } from "@/lib/data/scrutins";

interface DailyVotesPageProps {
  date: string;
  isToday?: boolean;
  typeTab?: string;
}

export async function DailyVotesPage({ date, isToday, typeTab = "votes" }: DailyVotesPageProps) {
  const [data, adjacent] = await Promise.all([getScrutinsByDate(date), getAdjacentVoteDates(date)]);

  const formatted = formatDateFrUTC(date);
  const title = isToday ? "Votes du jour" : `Votes du ${formatted}`;
  const canonicalPath = isToday ? "/parlement/votes/aujourd-hui" : `/parlement/votes/${date}`;

  // Compute type counts from loaded data
  let amendementCount = 0;
  let nonAmendementCount = 0;
  for (const s of data.scrutins) {
    if (s.type === "AMENDEMENT") amendementCount++;
    else nonAmendementCount++;
  }
  const totalAll = data.scrutins.length;

  // Filter scrutins by type tab
  let filtered = data.scrutins;
  if (typeTab === "votes") {
    filtered = data.scrutins.filter((s) => s.type !== "AMENDEMENT");
  } else if (typeTab === "amendements") {
    filtered = data.scrutins.filter((s) => s.type === "AMENDEMENT");
  }

  // Regroup filtered scrutins by chamber
  const grouped: Record<Chamber, DailyScrutin[]> = { AN: [], SENAT: [] };
  let adopted = 0;
  let rejected = 0;
  for (const s of filtered) {
    grouped[s.chamber].push(s);
    if (s.result === "ADOPTED") adopted++;
    else rejected++;
  }

  const buildTypeUrl = (tabKey: string) => {
    const base = canonicalPath;
    if (tabKey === "votes") return base;
    return `${base}?type=${tabKey}`;
  };

  const tabs = [
    {
      key: "votes",
      label: "Textes de loi",
      count: nonAmendementCount,
      href: buildTypeUrl("votes"),
    },
    {
      key: "amendements",
      label: "Amendements",
      count: amendementCount,
      href: buildTypeUrl("amendements"),
    },
    { key: "tous", label: "Tous", count: totalAll, href: buildTypeUrl("tous") },
  ];

  // Only show tabs if there are votes of multiple types
  const hasMultipleTypes = amendementCount > 0 && nonAmendementCount > 0;

  return (
    <>
      {data.total > 0 && (
        <CollectionPageJsonLd
          name={`Votes parlementaires du ${formatted}`}
          description={`${data.total} scrutins de l'Assemblée nationale et du Sénat du ${formatted}`}
          url={`${SITE_URL}${canonicalPath}`}
          numberOfItems={data.total}
        />
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb
            items={[
              { label: "Parlement", href: "/parlement" },
              { label: "Votes", href: "/parlement/votes" },
              { label: isToday ? "Aujourd'hui" : formatted },
            ]}
          />

          <h1 className="text-3xl font-display font-extrabold tracking-tight mb-4">{title}</h1>

          <DateNavigation
            prevDate={adjacent.prevDate}
            nextDate={adjacent.nextDate}
            currentDate={date}
            isToday={isToday}
          />
        </div>

        {data.total > 0 ? (
          <>
            {/* Type tabs */}
            {hasMultipleTypes && <ScrutinTypeTabs tabs={tabs} activeKey={typeTab} />}

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                <Vote className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {filtered.length} scrutin{filtered.length > 1 ? "s" : ""}
                </span>
              </div>
              {adopted > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {adopted} adopté{adopted > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {rejected > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {rejected} rejeté{rejected > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Chamber sections */}
            {(["AN", "SENAT"] as Chamber[]).map((chamber) => {
              const votes = grouped[chamber];
              if (votes.length === 0) return null;
              return <ChamberSection key={chamber} chamber={chamber} scrutins={votes} />;
            })}
          </>
        ) : (
          <EmptyState prevDate={adjacent.prevDate} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChamberSection({ chamber, scrutins }: { chamber: Chamber; scrutins: DailyScrutin[] }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <Building2
          className={`h-4 w-4 ${chamber === "AN" ? "text-blue-700" : "text-rose-700"}`}
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">{CHAMBER_LABELS[chamber]}</h2>
        <span className="text-sm text-muted-foreground">
          {scrutins.length} scrutin{scrutins.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-4">
        {scrutins.map((s) => (
          <div key={s.id}>
            <VoteCard
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
              type={s.type}
              policy={s.policyTitle}
            />
            {s.summary && <SummaryExcerpt summary={s.summary} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryExcerpt({ summary }: { summary: string }) {
  const firstParagraph = summary.split("\n\n")[0]?.trim();
  if (!firstParagraph) return null;

  return (
    <div className="mt-2 ml-4 pl-3 border-l-2 border-primary/20 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="h-3 w-3 text-primary/50" aria-hidden="true" />
        <span className="text-xs font-medium text-primary/50 uppercase tracking-wider">
          Résumé IA
        </span>
      </div>
      <p className="line-clamp-2">{firstParagraph}</p>
    </div>
  );
}

function EmptyState({ prevDate }: { prevDate: string | null }) {
  return (
    <div className="text-center py-20">
      <Vote className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-lg font-medium text-muted-foreground mb-2">Aucun scrutin ce jour</p>
      <p className="text-sm text-muted-foreground/60 mb-6">
        Le Parlement ne siège pas tous les jours (weekends, vacances, recesses).
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {prevDate && (
          <Link
            href={`/parlement/votes/${prevDate}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:underline"
            prefetch={false}
          >
            Derniers votes ({formatDateFrUTC(prevDate)})
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        <Link
          href="/parlement/votes"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          prefetch={false}
        >
          Voir tous les votes
        </Link>
      </div>
    </div>
  );
}
