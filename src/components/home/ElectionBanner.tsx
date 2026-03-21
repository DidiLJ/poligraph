import Link from "next/link";
import { ELECTION_TYPE_ICONS } from "@/config/labels";
import { ChevronRight } from "lucide-react";
import type { ElectionType } from "@/generated/prisma";

interface FeaturedElection {
  slug: string;
  title: string;
  shortTitle: string | null;
  type: ElectionType;
  round1Date: Date | null;
  hasResults: boolean;
  communesDepouillees: number;
}

interface ElectionBannerProps {
  election: FeaturedElection;
  daysUntil: number | null;
}

export function ElectionBanner({ election, daysUntil }: ElectionBannerProps) {
  return (
    <Link
      href={`/elections/${election.slug}`}
      prefetch={false}
      className="group block rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 text-white p-5 transition-all hover:shadow-lg hover:shadow-blue-900/20"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/15 text-2xl">
          {ELECTION_TYPE_ICONS[election.type]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-lg leading-tight">
            {election.shortTitle || election.title}
          </div>
          {daysUntil !== null && daysUntil > 0 && (
            <div className="text-sm text-blue-200 mt-0.5">J-{daysUntil}</div>
          )}
          {election.hasResults && (
            <div className="text-sm text-blue-200 mt-0.5">Résultats disponibles</div>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
