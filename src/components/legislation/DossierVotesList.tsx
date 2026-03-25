"use client";

import { useState } from "react";
import Link from "next/link";
import { VotingResultBadge } from "@/components/votes/VoteBadge";
import type { VotingResult, ScrutinType } from "@/types";

const INITIAL_COUNT = 10;

interface DossierVote {
  slug: string | null;
  title: string;
  votingDate: Date | string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
  type: ScrutinType | null;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

type Tab = "votes" | "amendements";

export function DossierVotesList({ votes }: { votes: DossierVote[] }) {
  const textVotes = votes.filter((v) => v.type !== "AMENDEMENT");
  const amendments = votes.filter((v) => v.type === "AMENDEMENT");
  const hasBothTypes = textVotes.length > 0 && amendments.length > 0;

  const [tab, setTab] = useState<Tab>("votes");
  const [showAll, setShowAll] = useState(false);

  const activeList = !hasBothTypes ? votes : tab === "votes" ? textVotes : amendments;
  const visible = showAll ? activeList : activeList.slice(0, INITIAL_COUNT);
  const remaining = activeList.length - INITIAL_COUNT;

  return (
    <div>
      {hasBothTypes && (
        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => {
              setTab("votes");
              setShowAll(false);
            }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === "votes"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Votes ({textVotes.length})
          </button>
          <button
            onClick={() => {
              setTab("amendements");
              setShowAll(false);
            }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === "amendements"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Amendements ({amendments.length})
          </button>
        </div>
      )}

      <div className="max-h-[600px] overflow-y-auto space-y-3 pr-1">
        {visible.map((scrutin, i) => {
          const total = scrutin.votesFor + scrutin.votesAgainst + scrutin.votesAbstain;
          const forPct = total > 0 ? (scrutin.votesFor / total) * 100 : 0;
          const againstPct = total > 0 ? (scrutin.votesAgainst / total) * 100 : 0;
          const abstainPct = total > 0 ? (scrutin.votesAbstain / total) * 100 : 0;

          return (
            <Link
              key={scrutin.slug ?? i}
              href={`/parlement/votes/${scrutin.slug}`}
              prefetch={false}
              className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium flex-1 min-w-0 leading-snug">{scrutin.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(scrutin.votingDate)}
                  </span>
                  <VotingResultBadge result={scrutin.result} />
                </div>
              </div>
              {total > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="bg-green-500" style={{ width: `${forPct}%` }} />
                  <div className="bg-red-500" style={{ width: `${againstPct}%` }} />
                  <div className="bg-yellow-500" style={{ width: `${abstainPct}%` }} />
                </div>
              )}
            </Link>
          );
        })}
      </div>
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full py-2 text-sm text-primary hover:underline font-medium"
        >
          Voir les {remaining} autres {tab === "amendements" ? "amendements" : "votes"}
        </button>
      )}
    </div>
  );
}
