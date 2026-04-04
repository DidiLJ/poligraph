import { AFFAIR_STATUS_LABELS } from "@/config/labels";
import { MATURITY_LABELS, type JudicialMaturity } from "@/config/judicial-maturity";
import type { AffairStatus } from "@/types";

const MATURITY_COLORS: Record<JudicialMaturity, string> = {
  CONDAMNATION: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PROCEDURE_VALIDEE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ENQUETE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  CLOSE_SANS_CONDAMNATION: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface AffairsSideData {
  count: number;
  byStatus: Record<string, number>;
  byMaturity: Record<string, number>;
}

interface AffairsSectionProps {
  left: AffairsSideData;
  right: AffairsSideData;
  leftLabel: string;
  rightLabel: string;
}

export function AffairsSection({ left, right, leftLabel, rightLabel }: AffairsSectionProps) {
  if (left.count === 0 && right.count === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Affaires judiciaires</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <AffairsSide data={left} label={leftLabel} />
        <AffairsSide data={right} label={rightLabel} />
      </div>
    </section>
  );
}

function AffairsSide({ data, label }: { data: AffairsSideData; label: string }) {
  if (data.count === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucune affaire judiciaire</p>
      </div>
    );
  }

  const statusEntries = Object.entries(data.byStatus).filter(([, count]) => count > 0);
  const maturityEntries = Object.entries(data.byMaturity).filter(([, count]) => count > 0);

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-3">
        {data.count} affaire{data.count > 1 ? "s" : ""}
      </p>

      {/* Maturity breakdown */}
      {maturityEntries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Par maturité judiciaire
          </p>
          <div className="flex flex-wrap gap-1.5">
            {maturityEntries.map(([maturity, count]) => (
              <span
                key={maturity}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${MATURITY_COLORS[maturity as JudicialMaturity] || ""}`}
              >
                {MATURITY_LABELS[maturity as JudicialMaturity] || maturity}
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown */}
      {statusEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Par statut</p>
          <ul className="space-y-1">
            {statusEntries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400">
                  {AFFAIR_STATUS_LABELS[status as AffairStatus] || status}
                </span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
