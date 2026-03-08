export interface DossierTimelineEntry {
  code: string; // "DEBATS-SEANCE", "COM-FOND-RAPPORT"
  label: string; // nomCanonique from AN open data
  date: string | null; // ISO date string
  chamber: string; // "AN" | "SENAT" | "CMP" | "CC" | "GOV"
  children?: DossierTimelineEntry[];
}
