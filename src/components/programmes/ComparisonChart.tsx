import { THEMATIC_AXIS_LABELS, THEMATIC_AXIS_SCOPE } from "@/config/labels";
import { POSITION_MAX } from "@/lib/programmes/matching";
import type { ThematicAxis } from "@/generated/prisma";

interface PartyPosition {
  partySlug: string;
  partyName: string;
  partyShortName: string;
  partyColor: string;
  positions: Partial<Record<ThematicAxis, number>>;
}

interface ComparisonChartProps {
  parties: PartyPosition[];
  className?: string;
}

// Only show COMMON axes in the comparison (5 axes shared across all elections)
const COMMON_AXES = (Object.keys(THEMATIC_AXIS_SCOPE) as ThematicAxis[]).filter(
  (axis) => THEMATIC_AXIS_SCOPE[axis] === "COMMON"
);

function ComparisonRow({ axis, parties }: { axis: ThematicAxis; parties: PartyPosition[] }) {
  return (
    <div className="space-y-2" role="group" aria-label={THEMATIC_AXIS_LABELS[axis]}>
      <span className="text-sm font-medium">{THEMATIC_AXIS_LABELS[axis]}</span>

      <div className="relative h-6 rounded-full bg-muted/60 border border-border/40">
        {/* Tick marks */}
        {Array.from({ length: 2 * POSITION_MAX + 1 }, (_, i) => {
          const tickPct = (i / (2 * POSITION_MAX)) * 100;
          const isCenter = i === POSITION_MAX;
          return (
            <div
              key={i}
              className={`absolute top-0 h-full -translate-x-px ${
                isCenter ? "w-0.5 bg-border" : "w-px bg-border/40"
              }`}
              style={{ left: `${tickPct}%` }}
            />
          );
        })}

        {/* Party dots */}
        {parties.map((party) => {
          const position = party.positions[axis];
          if (position === undefined) return null;
          const pct = ((position + POSITION_MAX) / (2 * POSITION_MAX)) * 100;
          return (
            <div
              key={party.partySlug}
              className="absolute top-1/2 h-5 w-5 rounded-full ring-2 ring-background shadow-sm -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct}%`, backgroundColor: party.partyColor }}
              title={`${party.partyShortName}: ${position > 0 ? "+" : ""}${position}`}
              aria-label={`${party.partyName}: position ${position > 0 ? "+" : ""}${position} sur ${THEMATIC_AXIS_LABELS[axis]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ComparisonChart({ parties, className }: ComparisonChartProps) {
  if (parties.length === 0) return null;

  return (
    <div
      className={className}
      role="img"
      aria-label="Comparaison des positions des partis sur les axes thématiques communs"
    >
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-5">
        {parties.map((party) => (
          <div key={party.partySlug} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: party.partyColor }}
              aria-hidden="true"
            />
            <span className="text-xs">{party.partyShortName}</span>
          </div>
        ))}
      </div>

      {/* Axis rows */}
      <div className="space-y-5">
        {COMMON_AXES.map((axis) => (
          <ComparisonRow key={axis} axis={axis} parties={parties} />
        ))}
      </div>
    </div>
  );
}
