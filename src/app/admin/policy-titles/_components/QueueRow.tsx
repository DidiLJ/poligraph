import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";
import type { QueueRow as QueueRowData } from "../_data/queue-query";

const CONFIDENCE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

const DEPTH_LABELS: Record<string, string> = {
  subAmendment: "Sous-amendement",
  amendment: "Amendement",
  exposeDesMotifs: "Exposé des motifs",
};

const RESULT_LABELS: Record<string, string> = {
  ADOPTED: "Adopté",
  REJECTED: "Rejeté",
};

export function QueueRow({ row }: { row: QueueRowData }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors align-top">
      {/* Meta: externalId · date · proceduralLabel */}
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        <div className="font-mono">{row.scrutinExternalId}</div>
        <div>{formatDateShort(row.votingDate)}</div>
        <div className="text-foreground">{row.proceduralLabel}</div>
      </td>

      {/* Titles */}
      <td className="px-4 py-3 max-w-md">
        <p className="text-xs text-muted-foreground truncate" title={row.officialTitleSnapshot}>
          {row.officialTitleSnapshot}
        </p>
        {row.policyTitle ? (
          <p className="font-semibold mt-0.5">{row.policyTitle}</p>
        ) : (
          <p className="italic text-red-600 mt-0.5">⚠ Aucun titre — saisie requise</p>
        )}
      </td>

      {/* Pills */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={CONFIDENCE_VARIANT[row.confidence] ?? "outline"}>{row.confidence}</Badge>
          {row.substanceDepth && (
            <Badge variant="outline">
              {DEPTH_LABELS[row.substanceDepth] ?? row.substanceDepth}
            </Badge>
          )}
          <Badge variant="outline">
            {row.evidenceCount} preuve{row.evidenceCount !== 1 ? "s" : ""}
          </Badge>
          {row.warningCount > 0 ? (
            <Badge variant={row.hasBlocker ? "destructive" : "secondary"}>
              {row.warningCount} avert.
            </Badge>
          ) : null}
          <Badge variant="outline">{RESULT_LABELS[row.result] ?? row.result}</Badge>
          {row.regenerationStatus !== "idle" && (
            <Badge variant="secondary">régén. : {row.regenerationStatus}</Badge>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/admin/policy-titles/${row.scrutinId}`}
          prefetch={false}
          className="text-sm text-primary hover:underline"
        >
          Réviser →
        </Link>
      </td>
    </tr>
  );
}
