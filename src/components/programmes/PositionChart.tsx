import { THEMATIC_AXIS_LABELS, THEMATIC_AXIS_POLE_A, THEMATIC_AXIS_POLE_B } from "@/config/labels";
import type { ThematicAxis } from "@/generated/prisma";
import { POSITION_MAX } from "@/lib/programmes/matching";

interface PositionChartProps {
  positions: Partial<Record<ThematicAxis, number>>;
  color?: string;
  className?: string;
}

function PositionRow({
  axis,
  position,
  color,
}: {
  axis: ThematicAxis;
  position: number;
  color: string;
}) {
  // Map -POSITION_MAX..+POSITION_MAX to 0%..100%
  const pct = ((position + POSITION_MAX) / (2 * POSITION_MAX)) * 100;

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-semibold">{THEMATIC_AXIS_LABELS[axis]}</span>

      {/* Scale bar */}
      <div className="relative h-2.5 rounded-full bg-muted/60 border border-border/40">
        {/* Tick marks at each integer position */}
        {Array.from({ length: 2 * POSITION_MAX + 1 }, (_, i) => {
          const tickPct = (i / (2 * POSITION_MAX)) * 100;
          const isCenter = i === POSITION_MAX;
          return (
            <div
              key={i}
              className={`absolute top-0 h-full -translate-x-px ${
                isCenter ? "w-0.5 bg-border" : "w-px bg-border/50"
              }`}
              style={{ left: `${tickPct}%` }}
            />
          );
        })}

        {/* Position dot */}
        <div
          className="absolute top-1/2 h-4 w-4 rounded-full shadow-md ring-2 ring-background -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Pole labels */}
      <div className="flex justify-between text-xs leading-snug">
        <span className="max-w-[45%] text-foreground/60">{THEMATIC_AXIS_POLE_A[axis]}</span>
        <span className="max-w-[45%] text-right text-foreground/60">
          {THEMATIC_AXIS_POLE_B[axis]}
        </span>
      </div>
    </div>
  );
}

export function PositionChart({ positions, color = "#3b82f6", className }: PositionChartProps) {
  const axes = Object.keys(positions) as ThematicAxis[];

  if (axes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">Aucune position renseignée</p>
    );
  }

  return (
    <div className={`space-y-6 ${className ?? ""}`}>
      {axes.map((axis) => (
        <PositionRow key={axis} axis={axis} position={positions[axis]!} color={color} />
      ))}
    </div>
  );
}
