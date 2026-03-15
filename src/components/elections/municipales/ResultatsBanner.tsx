import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";

interface ResultatsBannerProps {
  /** Winning or leading list */
  topList: {
    name: string;
    leaderName: string;
    partyLabel: string | null;
    round1Pct: number;
    round1Votes: number;
    isElected: boolean;
  } | null;
  /** Participation data */
  participation: {
    registeredVoters: number;
    actualVoters: number;
    participationRate: number;
  } | null;
  /** Total lists in this commune */
  listCount: number;
  /** Number of qualified lists for round 2 */
  qualifiedCount: number;
  /** Round 2 date if applicable */
  round2Date?: string | null;
}

export function ResultatsBanner({
  topList,
  participation,
  listCount,
  qualifiedCount,
  round2Date,
}: ResultatsBannerProps) {
  // No results at all: don't render
  if (!topList && !participation) return null;

  const isElected = topList?.isElected ?? false;

  // Participation-only state (partial import)
  if (!topList && participation) {
    return (
      <Card className="mb-6 border-muted">
        <CardContent className="pt-5">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {participation.participationRate.toFixed(2)} %
              </p>
              <p className="text-sm text-muted-foreground">Participation</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {participation.registeredVoters.toLocaleString("fr-FR")}
              </p>
              <p className="text-sm text-muted-foreground">Inscrits</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!topList) return null;

  return (
    <Card
      className={`mb-6 overflow-hidden border-0 ${
        isElected
          ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white"
          : "bg-gradient-to-r from-sky-600 to-sky-700 text-white"
      }`}
    >
      <CardContent className="p-0">
        {/* Top banner: winner/leader */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {isElected ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-base">{topList.name}</p>
              <p className="text-sm opacity-90">
                Tête de liste : {topList.leaderName}
                {topList.partyLabel ? ` (${topList.partyLabel})` : ""}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-extrabold tabular-nums tracking-tight">
              {topList.round1Pct.toFixed(2)} %
            </p>
            <p className="text-sm opacity-80 tabular-nums">
              {topList.round1Votes.toLocaleString("fr-FR")} voix
            </p>
          </div>
        </div>

        {/* Bottom stats row */}
        <div className="bg-white dark:bg-card text-foreground flex items-center justify-around py-3 px-4 text-sm">
          {participation && (
            <>
              <div className="text-center">
                <p className="font-bold text-lg tabular-nums">
                  {participation.participationRate.toFixed(1)} %
                </p>
                <p className="text-muted-foreground text-xs">Participation</p>
              </div>
              <div className="h-8 border-l border-border" />
              <div className="text-center">
                <p className="font-bold text-lg tabular-nums">
                  {participation.registeredVoters.toLocaleString("fr-FR")}
                </p>
                <p className="text-muted-foreground text-xs">Inscrits</p>
              </div>
              <div className="h-8 border-l border-border" />
            </>
          )}
          <div className="text-center">
            <p className="font-bold text-lg tabular-nums">{listCount}</p>
            <p className="text-muted-foreground text-xs">Listes</p>
          </div>
          <div className="h-8 border-l border-border" />
          <div className="text-center">
            {isElected ? (
              <>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Élu au 1er tour
                </p>
                <p className="text-muted-foreground text-xs">Majorité absolue</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-sky-700 dark:text-sky-400">
                  2nd tour{round2Date ? ` le ${round2Date}` : ""}
                </p>
                <p className="text-muted-foreground text-xs">
                  {qualifiedCount} liste{qualifiedCount > 1 ? "s" : ""} qualifiée
                  {qualifiedCount > 1 ? "s" : ""}
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
