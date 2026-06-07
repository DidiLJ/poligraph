import { Metadata } from "next";
import { DailyVotesPage } from "@/components/votes/DailyVotesPage";
import { getParisToday } from "@/lib/data/scrutins";

export const revalidate = 300; // ISR 5 min

export async function generateMetadata(): Promise<Metadata> {
  const today = getParisToday();
  const formatted = new Date(today + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    title: `Votes du jour — ${formatted}`,
    description: `Scrutins de l'Assemblée nationale et du Sénat du ${formatted}. Résultats, résumés et détails des votes parlementaires.`,
    alternates: { canonical: "/parlement/votes/aujourd-hui" },
  };
}

export default async function AujourdhuiPage() {
  const today = getParisToday();
  // The `type` tab is read client-side in DailyVotesList, so this route stays ISR.
  return <DailyVotesPage date={today} isToday />;
}
