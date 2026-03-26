import { ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { THEMATIC_AXIS_LABELS, THEMATIC_AXIS_POLE_A, THEMATIC_AXIS_POLE_B } from "@/config/labels";
import type { ThematicAxis } from "@/generated/prisma";

interface ProposalCardProps {
  axis: ThematicAxis;
  position: number; // -1, 0, 1
  summary: string;
  sourceExcerpt?: string | null;
  sourceUrl?: string | null;
  aiGenerated: boolean;
  verifiedBy?: string | null;
}

function PositionBadge({ position, axis }: { position: number; axis: ThematicAxis }) {
  const label =
    position === -1
      ? THEMATIC_AXIS_POLE_A[axis]
      : position === 1
        ? THEMATIC_AXIS_POLE_B[axis]
        : "Position intermédiaire";

  const colorClass =
    position === -1
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
      : position === 1
        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

export function ProposalCard({
  axis,
  position,
  summary,
  sourceExcerpt,
  sourceUrl,
  aiGenerated,
  verifiedBy,
}: ProposalCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm">{THEMATIC_AXIS_LABELS[axis]}</h3>
        {verifiedBy ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Vérifié
          </span>
        ) : aiGenerated ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            En attente de vérification
          </span>
        ) : null}
      </div>

      <PositionBadge position={position} axis={axis} />

      <p className="text-sm text-muted-foreground">{summary}</p>

      {sourceExcerpt && (
        <blockquote className="border-l-2 border-muted pl-3 text-xs text-muted-foreground italic">
          {sourceExcerpt}
        </blockquote>
      )}

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          aria-label={`Source pour ${THEMATIC_AXIS_LABELS[axis]} (ouvre dans un nouvel onglet)`}
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Source
        </a>
      )}
    </div>
  );
}
