"use client";

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { THEMATIC_AXIS_LABELS } from "@/config/labels";
import type { ThematicAxis } from "@/generated/prisma";

interface RadarDataPoint {
  axis: ThematicAxis;
  label: string;
  value: number; // -1 to 1
  // Normalized for radar display: 0 to 100
  display: number;
}

interface RadarChartProps {
  positions: Partial<Record<ThematicAxis, number>>;
  color?: string;
  className?: string;
}

function shortenLabel(label: string): string {
  // Take first 3 words max for readability on radar
  return label.split(" ").slice(0, 3).join(" ");
}

export function RadarChart({ positions, color = "#3b82f6", className }: RadarChartProps) {
  const axes = Object.keys(positions) as ThematicAxis[];

  if (axes.length < 3) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Au moins 3 axes sont nécessaires pour afficher le radar
      </p>
    );
  }

  const data: RadarDataPoint[] = axes.map((axis) => ({
    axis,
    label: shortenLabel(THEMATIC_AXIS_LABELS[axis]),
    value: positions[axis]!,
    display: ((positions[axis]! + 1) / 2) * 100, // -1..1 -> 0..100
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsRadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
          <Radar dataKey="display" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
