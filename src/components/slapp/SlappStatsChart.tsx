"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface SlappStatsChartProps {
  byStatus: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  ENQUETE_PRELIMINAIRE: "Enquête préliminaire",
  INSTRUCTION: "Instruction",
  MISE_EN_EXAMEN: "Mise en examen",
  RENVOI_TRIBUNAL: "Renvoi au tribunal",
  PROCES_EN_COURS: "Procès en cours",
  CONDAMNATION_PREMIERE_INSTANCE: "Condamnation 1re instance",
  APPEL_EN_COURS: "Appel en cours",
  CONDAMNATION_DEFINITIVE: "Condamnation définitive",
  RELAXE: "Relaxe",
  ACQUITTEMENT: "Acquittement",
  NON_LIEU: "Non-lieu",
  PRESCRIPTION: "Prescription",
  CLASSEMENT_SANS_SUITE: "Classement sans suite",
};

export function SlappStatsChart({ byStatus }: SlappStatsChartProps) {
  const data = Object.entries(byStatus).map(([status, count]) => ({
    status: STATUS_LABELS[status] ?? status,
    count,
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune donnée disponible pour le moment.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="status" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#b45309" name="Cas" />
      </BarChart>
    </ResponsiveContainer>
  );
}
