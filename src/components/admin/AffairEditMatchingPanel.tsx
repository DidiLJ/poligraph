"use client";

import { useRouter } from "next/navigation";
import { MatchingResolutionPanel } from "@/components/admin/MatchingResolutionPanel";
import type { BlockingDecision } from "@/lib/affairs/blocking-decisions";

interface Props {
  politicianId: string;
  politicianName: string;
  decisions: BlockingDecision[];
}

/**
 * Thin client wrapper for the edit page: a server component cannot hand a callback to the
 * resolution panel, so the « everything settled » refresh lives here. Refreshing re-runs
 * the guard and drops the panel once nothing blocks the affair any more.
 */
export function AffairEditMatchingPanel({ politicianId, politicianName, decisions }: Props) {
  const router = useRouter();
  return (
    <MatchingResolutionPanel
      politicianId={politicianId}
      politicianName={politicianName}
      decisions={decisions}
      onAllResolved={() => router.refresh()}
    />
  );
}
