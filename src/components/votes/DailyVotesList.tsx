"use client";

import { useSearchParams } from "next/navigation";
import { DailyVotesContent } from "./DailyVotesContent";
import type { DailyScrutin } from "@/lib/data/scrutins";

interface DailyVotesListProps {
  scrutins: DailyScrutin[];
  canonicalPath: string;
}

/**
 * Reads the `?type=` tab client-side and renders the (pure) DailyVotesContent.
 * Reading searchParams here instead of in the page keeps the scrutin-detail
 * [slug] route ISR-cacheable. The server renders DailyVotesContent with the
 * default "votes" tab as the Suspense fallback, so the list is in the SSR HTML
 * (SEO); this client pass only swaps the tab on ?type=. Must be inside Suspense.
 */
export function DailyVotesList({ scrutins, canonicalPath }: DailyVotesListProps) {
  const searchParams = useSearchParams();
  const typeTab = searchParams.get("type") || "votes";
  return <DailyVotesContent scrutins={scrutins} typeTab={typeTab} canonicalPath={canonicalPath} />;
}
