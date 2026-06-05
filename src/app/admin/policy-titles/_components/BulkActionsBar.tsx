"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { QueueRow, QueueFilters } from "../_data/queue-query";
import { batchApprove, batchRegenerate, exportPolicyTitlesCsv } from "../actions";

interface BulkActionsBarProps {
  /** The full visible rows, keyed by scrutinId, so the bar can read confidence/
   *  warnings for the best-effort client-side eligibility check. */
  rows: QueueRow[];
  selectedIds: string[];
  onClearSelection: () => void;
  /** The active on-screen queue filters, so the CSV export covers exactly the
   *  filtered set rather than every status. Pagination (skip/take) is ignored
   *  server-side: the export always pulls the full filtered set. */
  filters: QueueFilters;
}

/**
 * Best-effort client-side batch eligibility, mirroring the conservative server
 * rules we can see from the queue row: HIGH confidence, zero warnings, not a
 * FALLBACK row. The server re-checks everything (drift, generationWarnings,
 * sub-target) all-or-nothing, so this only gates the button, never the truth.
 */
function looksBatchEligible(row: QueueRow): boolean {
  return (
    row.confidence === "HIGH" &&
    row.warningCount === 0 &&
    !row.hasBlocker &&
    row.generationSource !== "FALLBACK"
  );
}

export function BulkActionsBar({
  rows,
  selectedIds,
  onClearSelection,
  filters,
}: BulkActionsBarProps) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedIds.length === 0) return null;

  const selectedRows = rows.filter((r) => selectedIds.includes(r.scrutinId));
  const allLookEligible =
    selectedRows.length > 0 && selectedRows.every((r) => looksBatchEligible(r));
  const count = selectedIds.length;

  function runApprove() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        const result = await batchApprove(selectedIds);
        if (result.approved > 0) {
          toast.success(
            `${result.approved} titre${result.approved !== 1 ? "s" : ""} approuvé${result.approved !== 1 ? "s" : ""}`
          );
          onClearSelection();
        } else {
          const detail = result.failures
            .map((f) => `${f.scrutinId} : ${f.reasons.join(", ")}`)
            .join(" — ");
          toast.error(`Aucun titre approuvé (tout ou rien). ${detail}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation par lot");
      }
    });
  }

  function runRegenerate() {
    startTransition(async () => {
      try {
        const result = await batchRegenerate(selectedIds);
        if (result.queued > 0) {
          toast.message(
            `${result.queued} titre${result.queued !== 1 ? "s" : ""} en file d'attente`,
            {
              description: result.note,
            }
          );
        } else {
          toast.success(
            `${result.ran} titre${result.ran !== 1 ? "s" : ""} régénéré${result.ran !== 1 ? "s" : ""}`
          );
        }
        onClearSelection();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors de la régénération par lot");
      }
    });
  }

  function runExport() {
    startTransition(async () => {
      try {
        const csv = await exportPolicyTitlesCsv(filters);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `policy-titles-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors de l'export CSV");
      }
    });
  }

  return (
    <>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur">
        <span className="text-sm font-medium">
          {count} sélectionné{count !== 1 ? "s" : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || !allLookEligible}
            onClick={() => setConfirmOpen(true)}
          >
            Approuver {count}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={runRegenerate}
          >
            Régénérer {count}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={runExport}>
            Exporter CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onClearSelection}
          >
            Annuler
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={runApprove}
        title={`Approuver ${count} titre${count !== 1 ? "s" : ""}`}
        description={`Ces ${count} titres deviendront éligibles à l'affichage public une fois le Plan 6 déployé.`}
        confirmLabel={`Approuver ${count}`}
      />
    </>
  );
}
