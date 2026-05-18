import Link from "next/link";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { formatDate } from "@/lib/utils";
import type { CandidatePresidentialRow, CrossCycleEntry } from "@/lib/data/candidates";

const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  DECLARE: { label: "Candidat déclaré", bg: "bg-emerald-500/90" },
  PRESSENTI: { label: "Candidat pressenti", bg: "bg-amber-500/90" },
  ENVISAGE: { label: "Candidature envisagée", bg: "bg-slate-400/90" },
  RETIRE: { label: "Candidature retirée", bg: "bg-red-500/90" },
};

interface Props {
  candidacy: CandidatePresidentialRow;
  crossCycle: (CrossCycleEntry & { round1Pct: number | null })[];
  promisesCount: number;
  votesParticipationPct: number | null;
  affairsCount: number;
}

export function CandidateHero({
  candidacy,
  crossCycle,
  promisesCount,
  votesParticipationPct,
  affairsCount,
}: Props) {
  const pres = candidacy.presidentialData;
  const accent = pres?.accentColor ?? candidacy.politician?.currentParty?.color ?? "#3b82f6";
  const badge = STATUS_BADGE[candidacy.status ?? "ENVISAGE"] ?? STATUS_BADGE.ENVISAGE!;

  const previousCycle = crossCycle.at(0);

  return (
    <header
      className="rounded-lg p-4 text-white sm:p-6"
      style={{ background: `linear-gradient(135deg, ${shade(accent, -25)}, ${accent})` }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <PoliticianAvatar
          photoUrl={candidacy.politician?.photoUrl ?? null}
          fullName={candidacy.candidateName}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl break-words">
            {candidacy.candidateName}
          </h1>
          <p className="text-sm opacity-90">
            {candidacy.politician?.currentParty?.name ??
              candidacy.party?.name ??
              candidacy.partyLabel ??
              ""}
            {candidacy.politician?.currentParty?.shortName
              ? ` · ${candidacy.politician.currentParty.shortName}`
              : ""}
          </p>
          {pres?.slogan && <p className="mt-1 text-sm italic opacity-95">« {pres.slogan} »</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.bg} self-start`}>
          {badge.label}
        </span>
      </div>

      {previousCycle && (
        <div className="mt-3 inline-flex items-center gap-2 rounded bg-white/15 px-3 py-1 text-xs">
          <span>
            Déjà candidat en {previousCycle.electionTitle.match(/\d{4}/)?.[0] ?? ""}
            {previousCycle.round1Pct != null && <> · T1 : {previousCycle.round1Pct.toFixed(2)}%</>}
          </span>
          <Link
            href={`/elections/${previousCycle.electionSlug}`}
            className="underline hover:no-underline"
          >
            Voir
          </Link>
        </div>
      )}

      {pres?.withdrewAt && pres.withdrewReason && (
        <div className="mt-3 rounded bg-red-700/30 px-3 py-2 text-xs">
          Retrait le {formatDate(pres.withdrewAt)}. {pres.withdrewReason}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded bg-white/15 px-2 py-2">
          <dt className="opacity-90">Promesses extraites</dt>
          <dd className="mt-0.5 text-lg font-bold">{promisesCount}</dd>
        </div>
        <div className="rounded bg-white/15 px-2 py-2">
          <dt className="opacity-90">Participation parlementaire</dt>
          <dd className="mt-0.5 text-lg font-bold">
            {votesParticipationPct != null ? `${votesParticipationPct.toFixed(0)}%` : "-"}
          </dd>
        </div>
        <div className="rounded bg-white/15 px-2 py-2">
          <dt className="opacity-90">Affaires (présomption d{"'"}innocence)</dt>
          <dd className="mt-0.5 text-lg font-bold">{affairsCount}</dd>
        </div>
      </dl>
    </header>
  );
}

function shade(hex: string, delta: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + delta));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (num & 0xff) + delta));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
