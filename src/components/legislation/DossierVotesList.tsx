"use client";

import { useState } from "react";
import Link from "next/link";
import { VotingResultBadge } from "@/components/votes/VoteBadge";
import type { VotingResult } from "@/types";

const INITIAL_COUNT = 10;

interface DossierVote {
  slug: string | null;
  title: string;
  votingDate: Date | string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

export function DossierVotesList({ votes }: { votes: DossierVote[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? votes : votes.slice(0, INITIAL_COUNT);
  const remaining = votes.length - INITIAL_COUNT;

  return (
    <div>
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
          Voir les {remaining} autres votes
        </button>
      )}
    </div>
  );
}
