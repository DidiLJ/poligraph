"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { User, Briefcase, Vote, FileCheck, Scale } from "lucide-react";

const VALID_TABS = ["profil", "carriere", "votes", "factchecks", "affaires"] as const;
type TabValue = (typeof VALID_TABS)[number];
const DEFAULT_TAB: TabValue = "profil";

interface ProfileTabsProps {
  profileContent: ReactNode;
  careerContent: ReactNode;
  votesContent: ReactNode | null;
  factchecksContent: ReactNode | null;
  affairsContent: ReactNode;
  affairsCount?: number;
}

function ProfileTabsInner({
  profileContent,
  careerContent,
  votesContent,
  factchecksContent,
  affairsContent,
  affairsCount,
}: ProfileTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab");
  const availableTabs: readonly TabValue[] = VALID_TABS.filter((t) => {
    if (t === "votes" && !votesContent) return false;
    if (t === "factchecks" && !factchecksContent) return false;
    return true;
  });
  const tab: TabValue = availableTabs.includes(rawTab as TabValue)
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
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="profil">
          <User className="size-4" />
          Profil
        </TabsTrigger>
        <TabsTrigger value="carriere">
          <Briefcase className="size-4" />
          Carriere
        </TabsTrigger>
        {votesContent && (
          <TabsTrigger value="votes">
            <Vote className="size-4" />
            Votes
          </TabsTrigger>
        )}
        {factchecksContent && (
          <TabsTrigger value="factchecks">
            <FileCheck className="size-4" />
            Fact-checks
          </TabsTrigger>
        )}
        <TabsTrigger value="affaires">
          <Scale className="size-4" />
          Affaires
          {affairsCount != null && affairsCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium min-w-[1.25rem] h-5 px-1.5">
              {affairsCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profil">{profileContent}</TabsContent>
      <TabsContent value="carriere">{careerContent}</TabsContent>
      {votesContent && <TabsContent value="votes">{votesContent}</TabsContent>}
      {factchecksContent && <TabsContent value="factchecks">{factchecksContent}</TabsContent>}
      <TabsContent value="affaires">{affairsContent}</TabsContent>
    </Tabs>
  );
}

export function ProfileTabs(props: ProfileTabsProps & { affairsCount?: number }) {
  return (
    <Suspense>
      <ProfileTabsInner {...props} />
    </Suspense>
  );
}
