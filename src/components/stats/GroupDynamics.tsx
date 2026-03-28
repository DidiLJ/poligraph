import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroupDynamicsStats } from "@/services/voteStats";

interface GroupDynamicsProps {
  dynamicsAN: GroupDynamicsStats[];
  dynamicsSENAT: GroupDynamicsStats[];
}

function AlignmentSpectrum({
  groups,
  chamberLabel,
}: {
  groups: GroupDynamicsStats[];
  chamberLabel: string;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>;
  }

  // Sort by alignment for the accessible table
  const sorted = [...groups].sort((a, b) => b.governmentAlignmentPct - a.governmentAlignmentPct);

  const descId = `alignment-desc-${chamberLabel.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      role="img"
      aria-label={`Alignement gouvernemental - ${chamberLabel}`}
      aria-describedby={descId}
    >
      {/* Zone labels above the spectrum */}
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">
        <span>Opposition</span>
        <span>Coalition</span>
      </div>

      {/* Spectrum visualization */}
      <div className="relative h-28 mb-2">
        {/* Background gradient */}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <div className="h-full bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80" />
        </div>

        {/* 50% center line (inside padded area) */}
        <div className="absolute top-0 h-full w-px bg-border" style={{ left: "calc(5% + 45%)" }} />

        {/* Group badges staggered across 3 rows to prevent overlap */}
        {assignRows(sorted).map(({ group: g, row }) => {
          // Map 0-100% to 5-95% to prevent edge clipping
          const leftPct = 5 + (g.governmentAlignmentPct / 100) * 90;
          // 3 rows distributed within the container height
          const topPx = 8 + row * 34;
          return (
            <Link
              key={g.groupId}
              href={g.groupSlug ? `/parlement/groupes/${g.groupSlug}` : "#"}
              prefetch={false}
              className="absolute -translate-x-1/2 transition-transform hover:scale-110 hover:z-10"
              style={{ left: `${leftPct}%`, top: `${topPx}px` }}
              title={`${g.groupName}: ${g.governmentAlignmentPct.toFixed(0)}% d'alignement`}
              aria-label={`${g.groupName}: ${g.governmentAlignmentPct.toFixed(0)}% d'alignement gouvernemental`}
            >
              <div
                className="px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-tight whitespace-nowrap shadow-sm border border-background/50"
                style={{
                  backgroundColor: g.groupColor || "#888",
                  color: isLightColor(g.groupColor) ? "#1a1a1a" : "#fff",
                }}
              >
                {g.groupCode}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Scale markers */}
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-1">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      {/* Screen reader table */}
      <table className="sr-only" id={descId}>
        <caption>Alignement gouvernemental par groupe - {chamberLabel}</caption>
        <thead>
          <tr>
            <th>Groupe</th>
            <th>Alignement</th>
            <th>Cohésion</th>
            <th>Participation</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <tr key={g.groupId}>
              <td>{g.groupName}</td>
              <td>{g.governmentAlignmentPct.toFixed(1)}%</td>
              <td>{g.cohesionPct.toFixed(1)}%</td>
              <td>{g.averageParticipationPct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsTable({ groups }: { groups: GroupDynamicsStats[] }) {
  const sorted = [...groups].sort((a, b) => b.governmentAlignmentPct - a.governmentAlignmentPct);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">Groupe</th>
            <th className="py-2 pr-3 text-right">Alignement</th>
            <th className="py-2 pr-3 text-right">Cohésion</th>
            <th className="py-2 text-right">Participation</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <tr key={g.groupId} className="border-b last:border-0">
              <td className="py-2 pr-3">
                <Link
                  href={g.groupSlug ? `/parlement/groupes/${g.groupSlug}` : "#"}
                  prefetch={false}
                  className="flex items-center gap-2 hover:underline"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: g.groupColor || "#888" }}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{g.groupCode}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-48">
                    {g.groupName}
                  </span>
                </Link>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                <span className={alignmentColor(g.governmentAlignmentPct)}>
                  {g.governmentAlignmentPct.toFixed(0)}%
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                <span className={cohesionColor(g.cohesionPct)}>{g.cohesionPct.toFixed(0)}%</span>
              </td>
              <td className="py-2 text-right tabular-nums">
                {g.averageParticipationPct.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GroupDynamics({ dynamicsAN, dynamicsSENAT }: GroupDynamicsProps) {
  return (
    <div className="space-y-6">
      {/* Alignment spectrums */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assemblée nationale</CardTitle>
          </CardHeader>
          <CardContent>
            <AlignmentSpectrum groups={dynamicsAN} chamberLabel="Assemblée nationale" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sénat</CardTitle>
          </CardHeader>
          <CardContent>
            <AlignmentSpectrum groups={dynamicsSENAT} chamberLabel="Sénat" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed metrics tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Métriques détaillées - AN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsTable groups={dynamicsAN} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Métriques détaillées - Sénat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsTable groups={dynamicsSENAT} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function isLightColor(hex: string | null): boolean {
  if (!hex) return false;
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Relative luminance approximation
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

/**
 * Assign groups to 3 vertical rows (0, 1, 2) to prevent badge overlap.
 * Groups sorted by alignment; each group is placed on the row that maximizes
 * horizontal distance from existing groups on that row.
 */
function assignRows(groups: GroupDynamicsStats[]): { group: GroupDynamicsStats; row: number }[] {
  const sorted = [...groups].sort((a, b) => a.governmentAlignmentPct - b.governmentAlignmentPct);
  const rows: number[][] = [[], [], []]; // Track used X positions per row
  const result: { group: GroupDynamicsStats; row: number }[] = [];

  for (const g of sorted) {
    const x = g.governmentAlignmentPct;
    // Pick the row where the nearest existing badge is farthest away
    let bestRow = 0;
    let bestDist = -1;
    for (let r = 0; r < 3; r++) {
      const minDist =
        rows[r]!.length === 0 ? Infinity : Math.min(...rows[r]!.map((px) => Math.abs(px - x)));
      if (minDist > bestDist) {
        bestDist = minDist;
        bestRow = r;
      }
    }
    rows[bestRow]!.push(x);
    result.push({ group: g, row: bestRow });
  }

  return result;
}

function alignmentColor(pct: number): string {
  if (pct >= 80) return "text-green-600 dark:text-green-400 font-semibold";
  if (pct >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function cohesionColor(pct: number): string {
  if (pct >= 95) return "text-green-600 dark:text-green-400";
  if (pct >= 85) return "text-yellow-600 dark:text-yellow-400";
  return "text-orange-600 dark:text-orange-400";
}
