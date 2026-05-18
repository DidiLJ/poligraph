import { THEME_CATEGORY_LABELS } from "@/config/labels";
import type { ThemeCategory } from "@/types";

export interface ThemeFocusItem {
  theme: ThemeCategory;
  count: number;
}

interface Props {
  items: ThemeFocusItem[];
  candidateName: string;
  maxAxes?: number;
  accentColor?: string;
  outerRadius?: number;
}

export function computeAxisCoordinates(
  index: number,
  total: number,
  radius: number
): [number, number] {
  const angle = index * ((2 * Math.PI) / total);
  return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

export function computeVertex(
  index: number,
  total: number,
  radius: number,
  count: number,
  maxCount: number
): [number, number] {
  const scale = maxCount > 0 ? count / maxCount : 0;
  const [x, y] = computeAxisCoordinates(index, total, radius);
  return [x * scale, y * scale];
}

export function ThemeFocusRadar({
  items,
  candidateName,
  maxAxes = 5,
  accentColor,
  outerRadius = 80,
}: Props) {
  const filtered = items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const top = filtered.slice(0, Math.max(2, maxAxes));

  if (top.length < 2) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Trop peu de promesses extraites pour un radar pertinent pour {candidateName}.
      </div>
    );
  }

  const maxCount = top[0]!.count;
  const fill = accentColor ?? "var(--color-primary, #6366f1)";
  const polygonPoints = top
    .map((item, i) => computeVertex(i, top.length, outerRadius, item.count, maxCount).join(","))
    .join(" ");
  const axisLines = top.map((_, i) => computeAxisCoordinates(i, top.length, outerRadius));

  const viewBox = `${-(outerRadius + 30)} ${-(outerRadius + 30)} ${(outerRadius + 30) * 2} ${(outerRadius + 30) * 2}`;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Axes de focalisation
      </div>
      <div className="mt-1 text-xs text-slate-700 dark:text-slate-200">
        {candidateName} · {filtered.reduce((s, i) => s + i.count, 0)} promesses extraites
      </div>
      <div className="my-3 flex justify-center">
        <svg
          viewBox={viewBox}
          width="260"
          height="260"
          role="img"
          aria-label={`Radar des axes de focalisation de ${candidateName}`}
        >
          <g stroke="currentColor" strokeOpacity="0.15" fill="none">
            <circle r={outerRadius} />
            <circle r={outerRadius * 0.75} />
            <circle r={outerRadius * 0.5} />
            <circle r={outerRadius * 0.25} />
          </g>
          <g stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.5">
            {axisLines.map(([x, y], i) => (
              <line key={i} x1={0} y1={0} x2={x} y2={y} />
            ))}
          </g>
          <polygon
            points={polygonPoints}
            fill={fill}
            fillOpacity="0.4"
            stroke={fill}
            strokeWidth="1.5"
          />
          <g fill={fill}>
            {top.map((item, i) => {
              const [vx, vy] = computeVertex(i, top.length, outerRadius, item.count, maxCount);
              return <circle key={item.theme} cx={vx} cy={vy} r={3} />;
            })}
          </g>
          <g>
            {top.map((item, i) => {
              const [lx, ly] = computeAxisCoordinates(i, top.length, outerRadius + 14);
              return (
                <text
                  key={item.theme}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="currentColor"
                  className="font-semibold text-slate-700 dark:text-slate-100"
                >
                  {THEME_CATEGORY_LABELS[item.theme]} · {item.count}
                </text>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-300">
        <div className="font-semibold">Top {top.length} thèmes</div>
        <ol className="mt-1 list-decimal pl-5 space-y-0.5">
          {top.map((item) => (
            <li key={item.theme}>
              {THEME_CATEGORY_LABELS[item.theme]} <strong>({item.count})</strong>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] italic text-slate-500 dark:text-slate-400">
          Mesure les axes que le candidat aborde dans ses promesses extraites. À confronter aux
          votes en section 3 pour distinguer le déclaratif de l{"'"}action.
        </p>
      </div>
    </div>
  );
}
