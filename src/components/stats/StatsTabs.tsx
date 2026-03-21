"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Scale, ShieldCheck, FileText, BarChart3 } from "lucide-react";

const VALID_TABS = ["judiciaire", "factchecks", "legislatif", "participation"] as const;
type TabValue = (typeof VALID_TABS)[number];
const DEFAULT_TAB: TabValue = "judiciaire";

interface StatsTabsProps {
  judicialContent: ReactNode;
  factCheckContent: ReactNode;
  legislativeContent: ReactNode;
  participationContent: ReactNode;
}

function StatsTabsInner({
  judicialContent,
  factCheckContent,
  legislativeContent,
  participationContent,
}: StatsTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("tab");
  const tab: TabValue = VALID_TABS.includes(rawTab as TabValue)
    ? (rawTab as TabValue)
    : DEFAULT_TAB;

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_TAB) {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.replace(`/statistiques${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <div className="overflow-x-auto scrollbar-hide">
        <TabsList>
          <TabsTrigger value="judiciaire">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Judiciaire</span>
            <span className="sm:hidden">Justice</span>
          </TabsTrigger>
          <TabsTrigger value="factchecks">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Fact-checking</span>
            <span className="sm:hidden">Facts</span>
          </TabsTrigger>
          <TabsTrigger value="legislatif">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Législatif</span>
            <span className="sm:hidden">Lois</span>
          </TabsTrigger>
          <TabsTrigger value="participation">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Participation</span>
            <span className="sm:hidden">Votes</span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="judiciaire">{judicialContent}</TabsContent>
      <TabsContent value="factchecks">{factCheckContent}</TabsContent>
      <TabsContent value="legislatif">{legislativeContent}</TabsContent>
      <TabsContent value="participation">{participationContent}</TabsContent>
    </Tabs>
  );
}

export function StatsTabs(props: StatsTabsProps) {
  return (
    <Suspense>
      <StatsTabsInner {...props} />
    </Suspense>
  );
}
