// Single source of truth for the plain-language steps of the French legislative
// procedure. Consumed by the <LegislativeJourney> card (/parlement/dossiers) and
// the pedagogy <details> on the /parlement hub.
//
// Adoption and promulgation are intentionally kept as DISTINCT steps: a text
// adopted by Parliament is not automatically promulgated nor in force. Do not
// merge them back into a single "the President promulgates the law" step.
export interface LegislativeJourneyStep {
  label: string;
  description: string;
}

export const LEGISLATIVE_JOURNEY_STEPS: LegislativeJourneyStep[] = [
  {
    label: "Dépôt",
    description: "Le texte est enregistré au Parlement, mais pas forcément examiné.",
  },
  {
    label: "Commission",
    description: "Les députés ou sénateurs étudient et amendent le texte avant le débat.",
  },
  {
    label: "Séance publique",
    description: "Le texte est débattu puis voté en public dans l'hémicycle.",
  },
  {
    label: "Navette",
    description: "L'Assemblée et le Sénat s'échangent le texte pour aboutir à une version commune.",
  },
  {
    label: "Adoption définitive",
    description:
      "Le Parlement a terminé l'examen, parfois après une commission mixte paritaire (CMP).",
  },
  {
    label: "Conseil constitutionnel & promulgation",
    description:
      "Contrôle éventuel, puis publication au Journal officiel : le texte entre en vigueur.",
  },
];
