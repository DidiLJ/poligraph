import { Card, CardContent } from "@/components/ui/card";
import type { QueueRow as QueueRowData } from "../_data/queue-query";
import { QueueRow } from "./QueueRow";

export function QueueTable({ rows, total }: { rows: QueueRowData[]; total: number }) {
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
                    <th className="px-4 py-3 font-medium text-muted-foreground">Scrutin</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Titres</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Signaux</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <QueueRow key={row.scrutinId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked rows */}
            <div className="sm:hidden divide-y divide-border">
              {rows.map((row) => (
                <table key={row.scrutinId} className="w-full text-sm">
                  <tbody>
                    <QueueRow row={row} />
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
    </Card>
  );
}
