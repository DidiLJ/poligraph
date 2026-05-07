import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getWeeklyRecap,
  getWeekStart,
  getWeekEnd,
  getISOWeekNumber,
  parseISOWeekString,
} from "@/lib/data/recap";
import { RecapView } from "@/components/recap/RecapView";

export const revalidate = 600;

interface PageProps {
  params: Promise<{ week: string }>;
}

function formatRange(start: Date, end: Date): string {
  const endDisplay = new Date(end);
  endDisplay.setUTCDate(endDisplay.getUTCDate() - 1);
  const startDay = start.getUTCDate();
  const endDay = endDisplay.getUTCDate();
  const startMonth = start.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  const endMonth = endDisplay.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  const year = start.getUTCFullYear();
  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonth} ${year}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { week } = await params;
  const weekStart = parseISOWeekString(week);
  if (!weekStart) {
    return { title: "Recap introuvable" };
  }
  const weekEnd = getWeekEnd(weekStart);
  const weekNum = getISOWeekNumber(weekStart);
  const range = formatRange(weekStart, weekEnd);
  return {
    title: `Le Recap parlementaire — Semaine ${weekNum}`,
    description: `Récapitulatif politique de la semaine du ${range}. Votes, activité parlementaire, affaires judiciaires, fact-checks et presse.`,
    alternates: { canonical: `/recap/${week}` },
  };
}

export default async function RecapWeekPage({ params }: PageProps) {
  const { week } = await params;
  const weekStart = parseISOWeekString(week);
  if (!weekStart) notFound();

  // Reject future weeks
  const currentWeekStart = getWeekStart(new Date());
  if (weekStart > currentWeekStart) notFound();

  const data = await getWeeklyRecap(weekStart);
  return <RecapView weekStart={weekStart} data={data} />;
}
