import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GitBranch } from "lucide-react";
import type { DossierTimelineEntry } from "@/types/legislation";
import { TIMELINE_CHAMBER_COLORS, TIMELINE_CHAMBER_LABELS } from "@/config/labels";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function sortByDate(entries: DossierTimelineEntry[]): DossierTimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

function TimelineEntry({
  entry,
  isChild = false,
}: {
  entry: DossierTimelineEntry;
  isChild?: boolean;
}) {
  const dotColor = TIMELINE_CHAMBER_COLORS[entry.chamber] || TIMELINE_CHAMBER_COLORS.UNKNOWN;
  const chamberLabel = TIMELINE_CHAMBER_LABELS[entry.chamber] || "";
  const dateStr = formatDate(entry.date);
  const dotSize = isChild ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const offset = isChild ? "-left-[17px]" : "-left-[21px]";

  return (
    <div className={isChild ? "ml-6" : ""}>
      <div className="relative border-l-2 border-border pl-6 pb-4 last:pb-0">
        {/* Dot */}
        <div
          className={`absolute ${offset} top-1 ${dotSize} rounded-full ${dotColor} ring-2 ring-background`}
        />

        {/* Content */}
        <div className="min-w-0">
          <p className={`font-medium ${isChild ? "text-sm" : "text-base"} leading-snug`}>
            {entry.label}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {chamberLabel && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${dotColor} text-white`}
              >
                {entry.chamber}
              </span>
            )}
            {dateStr && <span className="text-xs text-muted-foreground">{dateStr}</span>}
          </div>
        </div>

        {/* Children */}
        {entry.children && entry.children.length > 0 && (
          <div className="mt-3">
            {sortByDate(entry.children).map((child, i) => (
              <TimelineEntry key={`${child.code}-${i}`} entry={child} isChild />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DossierTimeline({ entries }: { entries: DossierTimelineEntry[] }) {
  if (!entries || entries.length === 0) return null;

  const sorted = sortByDate(entries);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
          Parcours législatif
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.map((entry, i) => (
          <TimelineEntry key={`${entry.code}-${i}`} entry={entry} />
        ))}
      </CardContent>
    </Card>
  );
}
