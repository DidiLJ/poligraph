export type DonationPlatform = {
  name: "HelloAsso" | "Tipeee";
  url: string;
  shortDescription: string;
  primary: boolean;
  legalEntity: "Sankofa" | "Poligraph";
};

// URL de la page HelloAsso de l'association Sankofa.
// L'URL pointe vers la page générique de l'asso, qui liste tous les formulaires de don actifs.
// Si un formulaire spécifique est préféré plus tard, le slug se trouve sous `/formulaires/<slug>`.
export const HELLOASSO_URL = "https://www.helloasso.com/associations/association-sankofa";

export const TIPEEE_URL = "https://fr.tipeee.com/poligraph";

export const DONATION_PLATFORMS = [
  {
    name: "HelloAsso",
    url: HELLOASSO_URL,
    shortDescription:
      "Don ponctuel ou récurrent à l'association Sankofa. Reçu fiscal à venir une fois le rescrit validé.",
    primary: true,
    legalEntity: "Sankofa",
  },
  {
    name: "Tipeee",
    url: TIPEEE_URL,
    shortDescription: "Soutien récurrent type tip jar, sans reçu fiscal, lié au projet Poligraph.",
    primary: false,
    legalEntity: "Poligraph",
  },
] as const satisfies readonly DonationPlatform[];

export type RescritStatus = "pending" | "in_review" | "validated";

// Statut du rescrit fiscal Sankofa au 2026-05-16. À ajuster ici quand l'admin Sankofa avance.
export const RESCRIT_STATUS: RescritStatus = "in_review";

export type Expense = {
  label: string;
  monthlyEuros: number;
  description: string;
};

export const EXPENSES = [
  {
    label: "Hébergement (Vercel Pro)",
    monthlyEuros: 20,
    description: "Serveurs, CDN, certificats SSL",
  },
  {
    label: "APIs IA (Anthropic, OpenAI)",
    monthlyEuros: 50,
    description: "Résumés automatiques, chatbot, embeddings",
  },
  {
    label: "Base de données (Supabase)",
    monthlyEuros: 25,
    description: "PostgreSQL, stockage, backups",
  },
  {
    label: "Domaine et services",
    monthlyEuros: 10,
    description: "Nom de domaine, emails, monitoring",
  },
] as const satisfies readonly Expense[];

export function totalMonthlyEuros(): number {
  return EXPENSES.reduce((sum, e) => sum + e.monthlyEuros, 0);
}

export const FEATURES_FUNDED = [
  "Mise à jour quotidienne des données parlementaires",
  "Résumés IA des dossiers législatifs",
  "Chatbot citoyen pour poser des questions",
  "Alertes sur les nouvelles affaires judiciaires",
  "API ouverte pour les journalistes et chercheurs",
  "Zéro publicité, zéro tracking",
] as const satisfies readonly string[];
