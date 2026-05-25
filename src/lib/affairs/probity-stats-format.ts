export interface ProbityStats {
  total: number;
  etabli: number;
  prononce: number;
  enCours: number;
  closFavorable: number;
}

export function formatProbityBreakdown(stats: ProbityStats): string {
  if (stats.total === 0) return "Présomption d'innocence";
  const parts: string[] = [];
  if (stats.etabli > 0) parts.push(`${stats.etabli} établie${stats.etabli > 1 ? "s" : ""}`);
  if (stats.prononce > 0) parts.push(`${stats.prononce} prononcée${stats.prononce > 1 ? "s" : ""}`);
  if (stats.enCours > 0) parts.push(`${stats.enCours} en cours`);
  if (stats.closFavorable > 0)
    parts.push(`${stats.closFavorable} close${stats.closFavorable > 1 ? "s" : ""}`);
  return parts.join(", ");
}
