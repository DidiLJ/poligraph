"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { QueueRow as QueueRowData, QueueFilters } from "../_data/queue-query";
import { QueueRow } from "./QueueRow";
import { BulkActionsBar } from "./BulkActionsBar";

export function QueueTable({
  rows,
  total,
  filters,
}: {
  rows: QueueRowData[];
  total: number;
  filters: QueueFilters;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(scrutinId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scrutinId);
      else next.delete(scrutinId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.scrutinId)) : new Set());
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedIds = Array.from(selected);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.scrutinId));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">
            {total} titre{total !== 1 ? "s" : ""} dans la file
          </span>
        </div>

        {rows.length > 0 ? (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Tout sélectionner"
                        className="h-4 w-4"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Scrutin</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Titres</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Signaux</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <QueueRow
                      key={row.scrutinId}
                      row={row}
                      selected={selected.has(row.scrutinId)}
                      onToggle={toggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked rows */}
            <div className="sm:hidden divide-y divide-border">
              {rows.map((row) => (
                <table key={row.scrutinId} className="w-full text-sm">
                  <tbody>
                    <QueueRow row={row} selected={selected.has(row.scrutinId)} onToggle={toggle} />
                  </tbody>
                </table>
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun titre ne correspond à ces critères
          </div>
        )}
      </CardContent>

      <BulkActionsBar
        rows={rows}
        selectedIds={selectedIds}
        onClearSelection={clearSelection}
        filters={filters}
      />
    </Card>
  );
}
