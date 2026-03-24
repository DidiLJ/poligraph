import Link from "next/link";
import { VotingResultBadge } from "./VoteBadge";
import { THEME_CATEGORY_LABELS, THEME_CATEGORY_COLORS } from "@/config/labels";
import { Calendar, Users, Star } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { VotingResult, ThemeCategory } from "@/types";

interface HeroSpotlightProps {
  slug: string | null;
  id: string;
  title: string;
  votingDate: Date | string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
  theme: ThemeCategory | null;
  summary: string | null;
  citizenImpact: string | null;
}

export function HeroSpotlight({
  slug,
  id,
  title,
  votingDate,
  votesFor,
  votesAgainst,
  votesAbstain,
  result,
  theme,
  summary,
  citizenImpact,
}: HeroSpotlightProps) {
  const href = `/parlement/votes/${slug || id}`;
  const total = votesFor + votesAgainst + votesAbstain;
  const forPct = total > 0 ? (votesFor / total) * 100 : 0;
  const againstPct = total > 0 ? (votesAgainst / total) * 100 : 0;
  // Prefer citizenImpact (citizen-friendly, formatted) over raw summary
  const displayText = citizenImpact || summary;

  return (
    <Link
      href={href}
      prefetch={false}
      className="block rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white p-6 md:p-8 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-amber-400" aria-hidden="true" />
        <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Vote clé</span>
      </div>

      <h2 className="text-xl md:text-2xl font-display font-extrabold tracking-tight mb-3">
        {title}
      </h2>

      {displayText && (
        <p className="text-sm text-slate-300 line-clamp-3 mb-4">
          {displayText.replace(/[#*_]/g, "").trim()}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <VotingResultBadge result={result} />
        <span className="flex items-center gap-1 text-sm text-slate-300">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(new Date(votingDate))}
        </span>
        <span
          className="flex items-center gap-1 text-sm text-slate-300"
          aria-label={`${total} votants : ${votesFor} pour, ${votesAgainst} contre, ${votesAbstain} abstentions`}
        >
          <Users className="h-3.5 w-3.5" />
          {total} votants
        </span>
        {theme && (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${THEME_CATEGORY_COLORS[theme]}`}
          >
            {THEME_CATEGORY_LABELS[theme]}
          </span>
        )}
      </div>

      <div
        className="flex h-2 rounded-full overflow-hidden bg-slate-700"
        role="img"
        aria-label={`Résultat : ${votesFor} pour, ${votesAgainst} contre, ${votesAbstain} abstentions`}
      >
        <div className="bg-green-500" style={{ width: `${forPct}%` }} />
        <div className="bg-red-500" style={{ width: `${againstPct}%` }} />
        <div className="bg-yellow-500" style={{ width: `${100 - forPct - againstPct}%` }} />
      </div>
    </Link>
  );
}
