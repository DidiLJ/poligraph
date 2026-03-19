import { AFFAIR_STATUS_LABELS } from "@/config/labels";
import { CERTAINTY_LABELS, CERTAINTY_COLORS, type CertaintyLevel } from "@/config/certainty";
import type { AffairStatus } from "@/types";

interface AffairsSideData {
  count: number;
  byStatus: Record<string, number>;
  byCertainty: Record<string, number>;
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
  const certaintyEntries = Object.entries(data.byCertainty).filter(([, count]) => count > 0);

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-3">
        {data.count} affaire{data.count > 1 ? "s" : ""}
      </p>

      {/* Certainty breakdown */}
      {certaintyEntries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Par certitude</p>
          <div className="flex flex-wrap gap-1.5">
            {certaintyEntries.map(([certainty, count]) => (
              <span
                key={certainty}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${CERTAINTY_COLORS[certainty as CertaintyLevel] || ""}`}
              >
                {CERTAINTY_LABELS[certainty as CertaintyLevel] || certainty}
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
