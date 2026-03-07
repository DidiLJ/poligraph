"use client";

import { useMemo, useState, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import { scaleLinear } from "d3-scale";
import { computeHemicycleLayout } from "./hemicycle-layout";
import type { HemicycleGroup, HemicycleDeputy } from "@/lib/data/hemicycle";

interface HemicycleProps {
  groups: HemicycleGroup[];
}

interface TooltipData {
  deputy: HemicycleDeputy;
  groupName: string;
  groupCode: string;
  x: number;
  y: number;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 420;
const BASE_RADIUS = 3.8;
const MAX_SCALE = 3;

export function Hemicycle({ groups }: HemicycleProps) {
  const router = useRouter();
  const descId = useId();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [highlightGroup, setHighlightGroup] = useState<string | null>(null);

  // Build flat deputy list matching seat order
  const { seats, deputyMap, totalWithAffairs, totalDeputies } = useMemo(() => {
    // Filter out empty groups (no current deputies)
    const activeGroups = groups.filter((g) => g.deputies.length > 0);
    const groupInputs = activeGroups.map((g) => ({
      code: g.code,
      color: g.color,
      seats: g.deputies.length,
    }));

    const seatPositions = computeHemicycleLayout(groupInputs, {
      width: SVG_WIDTH,
      height: SVG_HEIGHT - 20, // leave space for bottom
    });

    // Build deputy map: for each group, assign deputies to seats in order
    const dMap = new Map<
      number,
      { deputy: HemicycleDeputy; groupName: string; groupCode: string }
    >();
    let globalIdx = 0;
    for (const group of activeGroups) {
      // Sort deputies: those with affairs first (visually interesting), then alphabetical
      const sorted = [...group.deputies].sort((a, b) => {
        if (b.affairCount !== a.affairCount) return b.affairCount - a.affairCount;
        return a.lastName.localeCompare(b.lastName, "fr");
      });
      for (const deputy of sorted) {
        dMap.set(globalIdx, {
          deputy,
          groupName: group.shortName || group.name,
          groupCode: group.code,
        });
        globalIdx++;
      }
    }

    const total = globalIdx;
    const withAffairs = [...dMap.values()].filter((d) => d.deputy.affairCount > 0).length;

    return {
      seats: seatPositions,
      deputyMap: dMap,
      totalWithAffairs: withAffairs,
      totalDeputies: total,
    };
  }, [groups]);

  // Radius scale: affair count → circle radius
  const radiusScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, 1, 5])
        .range([BASE_RADIUS, BASE_RADIUS * 1.8, BASE_RADIUS * MAX_SCALE])
        .clamp(true),
    []
  );

  const handleMouseEnter = useCallback(
    (seatIdx: number, event: React.MouseEvent<SVGCircleElement>) => {
      const data = deputyMap.get(seatIdx);
      if (!data) return;
      const svg = event.currentTarget.closest("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setTooltip({
        deputy: data.deputy,
        groupName: data.groupName,
        groupCode: data.groupCode,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [deputyMap]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleClick = useCallback(
    (seatIdx: number) => {
      const data = deputyMap.get(seatIdx);
      if (data) router.push(`/politiques/${data.deputy.slug}`);
    },
    [deputyMap, router]
  );

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Hémicycle de l'Assemblée nationale : ${totalWithAffairs} député${totalWithAffairs !== 1 ? "s" : ""} concerné${totalWithAffairs !== 1 ? "s" : ""} par au moins une affaire judiciaire sur ${totalDeputies}`}
        aria-describedby={descId}
      >
        {seats.map((seat, i) => {
          const data = deputyMap.get(seat.seatIndex);
          const affairCount = data?.deputy.affairCount ?? 0;
          const r = radiusScale(affairCount);
          const isHighlighted = !highlightGroup || seat.groupCode === highlightGroup;
          const hasAffairs = affairCount > 0;

          return (
            <circle
              key={i}
              cx={seat.x}
              cy={seat.y}
              r={r}
              fill={seat.groupColor}
              opacity={isHighlighted ? (hasAffairs ? 1 : 0.35) : 0.08}
              stroke={hasAffairs ? "rgba(0,0,0,0.3)" : "none"}
              strokeWidth={hasAffairs ? 0.5 : 0}
              className="cursor-pointer transition-opacity duration-200"
              onMouseEnter={(e) => handleMouseEnter(seat.seatIndex, e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(seat.seatIndex)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2 text-sm shadow-md max-w-[200px]"
          style={{
            left: `clamp(100px, ${tooltip.x}px, calc(100% - 100px))`,
            top: Math.max(0, tooltip.y - 10),
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold">
            {tooltip.deputy.firstName} {tooltip.deputy.lastName}
          </div>
          <div className="text-muted-foreground">
            {tooltip.groupName} ({tooltip.groupCode})
          </div>
          {tooltip.deputy.affairCount > 0 && (
            <div className="text-amber-600 dark:text-amber-400 font-medium">
              {tooltip.deputy.affairCount} affaire
              {tooltip.deputy.affairCount !== 1 ? "s" : ""} judiciaire
              {tooltip.deputy.affairCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
        {groups.map((g) => (
          <button
            key={g.code}
            className="flex items-center gap-1.5 text-xs hover:underline"
            style={{ opacity: !highlightGroup || highlightGroup === g.code ? 1 : 0.4 }}
            onClick={() => setHighlightGroup((prev) => (prev === g.code ? null : g.code))}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: g.color }}
            />
            <span>{g.shortName || g.code}</span>
            <span className="text-muted-foreground">({g.deputies.length})</span>
          </button>
        ))}
      </div>

      {/* Summary stat */}
      <p className="text-center text-sm text-muted-foreground mt-2">
        <span className="font-semibold text-amber-600 dark:text-amber-400">{totalWithAffairs}</span>{" "}
        député{totalWithAffairs !== 1 ? "s" : ""} concerné
        {totalWithAffairs !== 1 ? "s" : ""} par au moins une affaire judiciaire sur{" "}
        <span className="font-semibold">{totalDeputies}</span>
      </p>

      {/* SR-only accessible table */}
      <table className="sr-only" id={descId}>
        <caption>Affaires judiciaires par groupe parlementaire</caption>
        <thead>
          <tr>
            <th>Groupe</th>
            <th>Députés</th>
            <th>Avec affaires</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.code}>
              <td>{g.shortName || g.name}</td>
              <td>{g.deputies.length}</td>
              <td>{g.deputies.filter((d) => d.affairCount > 0).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
