import type { ThemeCategory } from "@/types";

export interface ThemeRule {
  theme: ThemeCategory;
  keywords: string[];
  weight: number;
}

export const THEME_RULES: ThemeRule[] = [
  {
    theme: "ECONOMIE_BUDGET",
    keywords: [
      "budget",
      "déficit",
      "impôt",
      "impots",
      "smic",
      "salaire minimum",
      "tva",
      "fiscalité",
      "dette publique",
      "inflation",
    ],
    weight: 1.0,
  },
  {
    theme: "IMMIGRATION",
    keywords: [
      "immigration",
      "migrant",
      "réfugié",
      "frontière",
      "ofpra",
      "asile",
      "naturalisation",
      "expulsion",
    ],
    weight: 1.0,
  },
  {
    theme: "ENVIRONNEMENT_ENERGIE",
    keywords: [
      "écologie",
      "climat",
      "transition énergétique",
      "renouvelable",
      "nucléaire",
      "biodiversité",
      "co2",
      "réchauffement",
      "pesticide",
    ],
    weight: 1.0,
  },
  {
    theme: "SECURITE_JUSTICE",
    keywords: [
      "police",
      "gendarmerie",
      "délinquance",
      "violence",
      "magistrat",
      "tribunal",
      "peine de prison",
      "sécurité",
    ],
    weight: 1.0,
  },
  {
    theme: "SANTE",
    keywords: [
      "hôpital",
      "médecin",
      "remboursement",
      "sécurité sociale",
      "ssa",
      "soins",
      "déserts médicaux",
    ],
    weight: 1.0,
  },
  {
    theme: "EDUCATION_CULTURE",
    keywords: ["école", "lycée", "enseignant", "professeur", "université", "bac", "culture"],
    weight: 1.0,
  },
  {
    theme: "INSTITUTIONS",
    keywords: [
      "constitution",
      "référendum",
      "vie 6e république",
      "vième république",
      "élections",
      "scrutin proportionnel",
    ],
    weight: 1.0,
  },
  {
    theme: "AFFAIRES_ETRANGERES_DEFENSE",
    keywords: ["défense", "armée", "ukraine", "russie", "otan", "diplomatie", "ambassadeur"],
    weight: 1.0,
  },
  {
    theme: "NUMERIQUE_TECH",
    keywords: [
      "numérique",
      "intelligence artificielle",
      "ia",
      "cybersécurité",
      "souveraineté numérique",
      "data",
    ],
    weight: 1.0,
  },
  {
    theme: "AGRICULTURE_ALIMENTATION",
    keywords: ["agriculteur", "agriculture", "pac", "paysan", "alimentation", "élevage"],
    weight: 1.0,
  },
  {
    theme: "LOGEMENT_URBANISME",
    keywords: ["logement social", "hlm", "urbanisme", "loyer", "propriétaire"],
    weight: 1.0,
  },
  {
    theme: "TRANSPORTS",
    keywords: ["sncf", "tgv", "train", "transport", "métro", "voiture électrique"],
    weight: 1.0,
  },
  {
    theme: "SOCIAL_TRAVAIL",
    keywords: [
      "chômage",
      "retraite",
      "travail",
      "syndicat",
      "rsa",
      "minima sociaux",
      "code du travail",
    ],
    weight: 1.0,
  },
];
