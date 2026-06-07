"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { VoteCard } from "./VoteCard";
import { ScrutinTypeTabs } from "./ScrutinTypeTabs";
import { CHAMBER_LABELS } from "@/config/labels";
import { Vote, CheckCircle, XCircle, Building2, Sparkles } from "lucide-react";
import type { Chamber } from "@/generated/prisma";
import type { DailyScrutin } from "@/lib/data/scrutins";

interface DailyVotesListProps {
  scrutins: DailyScrutin[];
  canonicalPath: string;
}

/**
 * Client-side type-tab filtering for the daily votes view. The server fetches
 * ALL scrutins for the date (it never filtered server-side), so reading the
 * `?type=` tab here via useSearchParams keeps the date-archive route static/ISR
 * instead of forcing it dynamic. Must be rendered inside a Suspense boundary.
 */
export function DailyVotesList({ scrutins, canonicalPath }: DailyVotesListProps) {
  const searchParams = useSearchParams();
  const typeTab = searchParams.get("type") || "votes";

  const { filtered, grouped, adopted, rejected, tabs, hasMultipleTypes } = useMemo(() => {
    let amendementCount = 0;
    let nonAmendementCount = 0;
    for (const s of scrutins) {
      if (s.type === "AMENDEMENT") amendementCount++;
      else nonAmendementCount++;
    }
    const totalAll = scrutins.length;

    let filtered = scrutins;
    if (typeTab === "votes") {
      filtered = scrutins.filter((s) => s.type !== "AMENDEMENT");
    } else if (typeTab === "amendements") {
      filtered = scrutins.filter((s) => s.type === "AMENDEMENT");
    }

    const grouped: Record<Chamber, DailyScrutin[]> = { AN: [], SENAT: [] };
    let adopted = 0;
    let rejected = 0;
    for (const s of filtered) {
      grouped[s.chamber].push(s);
      if (s.result === "ADOPTED") adopted++;
      else rejected++;
    }

    const buildTypeUrl = (tabKey: string) =>
      tabKey === "votes" ? canonicalPath : `${canonicalPath}?type=${tabKey}`;

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

    return {
      filtered,
      grouped,
      adopted,
      rejected,
      tabs,
      hasMultipleTypes: amendementCount > 0 && nonAmendementCount > 0,
    };
  }, [scrutins, typeTab, canonicalPath]);

  return (
    <>
      {hasMultipleTypes && <ScrutinTypeTabs tabs={tabs} activeKey={typeTab} />}

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

      {(["AN", "SENAT"] as Chamber[]).map((chamber) => {
        const votes = grouped[chamber];
        if (votes.length === 0) return null;
        return <ChamberSection key={chamber} chamber={chamber} scrutins={votes} />;
      })}
    </>
  );
}

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
