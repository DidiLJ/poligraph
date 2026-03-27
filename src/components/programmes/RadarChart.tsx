"use client";

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { ThematicAxis } from "@/generated/prisma";
import { POSITION_MAX } from "@/lib/programmes/matching";

// Short labels optimized for radar readability
const RADAR_LABELS: Record<ThematicAxis, string> = {
  ECONOMIC_ROLE: "Économie",
  SOCIETAL_NORMS: "Société",
  ECOLOGICAL_TRANSITION: "Écologie",
  SECURITY_LIBERTIES: "Sécurité / libertés",
  DEMOCRACY_INSTITUTIONS: "Institutions",
  EUROPEAN_INTEGRATION: "Europe",
  IMMIGRATION: "Immigration",
  FOREIGN_AFFAIRS: "International",
  URBAN_PLANNING: "Urbanisme",
  PUBLIC_SERVICES: "Services publics",
  MOBILITY: "Mobilité",
};

interface RadarChartProps {
  positions: Partial<Record<ThematicAxis, number>>;
  color?: string;
  className?: string;
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

  const data = axes.map((axis) => ({
    axis,
    label: RADAR_LABELS[axis],
    // Normalize absolute position to 0..100 (0=neutral, 100=strong stance)
    display: (Math.abs(positions[axis]!) / POSITION_MAX) * 100,
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
      <p className="text-xs text-muted-foreground text-center mt-1">
        Intensité des positions (centre = neutre, bord = position tranchée)
      </p>
    </div>
  );
}
