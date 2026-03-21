import { Metadata } from "next";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/config/site";
import { getWeeklyRecap, getWeekStart } from "@/lib/data/recap";
import { getFeaturedElection } from "@/lib/data/elections";
import { getHomepageKPIs } from "@/lib/data/homepage";
import { getTopMovers } from "@/lib/data/top-movers";
import { getEnabledFlags } from "@/lib/feature-flags";
import { WelcomeBar } from "@/components/home/WelcomeBar";
import { KPIStrip } from "@/components/home/KPIStrip";
import { ElectionBanner } from "@/components/home/ElectionBanner";
import { TopMovers } from "@/components/home/TopMovers";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { QuickAccess } from "@/components/home/QuickAccess";
import { SupportBar } from "@/components/home/SupportBar";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Poligraph - Observatoire citoyen de la politique française",
  description:
    "Suivez les votes, affaires judiciaires, fact-checks et déclarations de patrimoine des politiques français. Données ouvertes, transparence citoyenne.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  const [kpis, topMovers, weeklyRecap, featuredElection, enabledFlags] = await Promise.all([
    getHomepageKPIs(),
    getTopMovers(),
    getWeeklyRecap(currentWeekStart),
    getFeaturedElection(),
    getEnabledFlags(),
  ]);

  const daysUntil = featuredElection?.round1Date
    ? Math.ceil(
        (new Date(featuredElection.round1Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <>
      <WebSiteJsonLd
        name="Poligraph"
        description="Observatoire citoyen de la vie politique. Mandats, votes, patrimoine, affaires judiciaires et fact-checking."
        url={SITE_URL}
      />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <WelcomeBar />

        {featuredElection && <ElectionBanner election={featuredElection} daysUntil={daysUntil} />}

        <KPIStrip kpis={kpis} />

        <TopMovers movers={topMovers} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ActivityFeed recap={weeklyRecap} />
          <QuickAccess enabledFlags={enabledFlags} />
        </div>

        <SupportBar />
      </div>
    </>
  );
}
