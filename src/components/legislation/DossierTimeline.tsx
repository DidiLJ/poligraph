import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GitBranch } from "lucide-react";
import type { DossierTimelineEntry } from "@/types/legislation";
import { TIMELINE_CHAMBER_LABELS } from "@/config/labels";

/** Tailwind bg-* → text-* for the timeline line accent */
const CHAMBER_LINE_COLORS: Record<string, string> = {
  AN: "border-blue-400",
  SENAT: "border-rose-400",
  CMP: "border-purple-400",
  CC: "border-amber-400",
  GOV: "border-emerald-400",
  UNKNOWN: "border-gray-300",
};

const CHAMBER_DOT_BG: Record<string, string> = {
  AN: "bg-blue-500",
  SENAT: "bg-rose-500",
  CMP: "bg-purple-500",
  CC: "bg-amber-500",
  GOV: "bg-emerald-500",
  UNKNOWN: "bg-gray-400",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Paris",
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

/**
 * Flatten nested timeline into leaf events (those with dates),
 * preserving the depth for indentation but removing structural-only parents.
 */
interface FlatEntry {
  code: string;
  label: string;
  date: string | null;
  chamber: string;
  depth: number;
}

function flattenEntries(entries: DossierTimelineEntry[], depth: number = 0): FlatEntry[] {
  const result: FlatEntry[] = [];
  for (const entry of entries) {
    // Always include entries that have a date (real events)
    if (entry.date) {
      result.push({
        code: entry.code,
        label: entry.label,
        date: entry.date,
        chamber: entry.chamber,
        depth,
      });
    }
    // Recurse into children
    if (entry.children && entry.children.length > 0) {
      result.push(...flattenEntries(entry.children, depth + 1));
    }
  }
  return result;
}

/**
 * Top-level phase: "1ère lecture (1ère assemblée saisie)", etc.
 * These become the phase headers with chamber badges.
 */
function PhaseHeader({ entry }: { entry: DossierTimelineEntry }) {
  const dotBg = CHAMBER_DOT_BG[entry.chamber] || CHAMBER_DOT_BG.UNKNOWN;
  const chamberLabel = TIMELINE_CHAMBER_LABELS[entry.chamber] || entry.chamber;

  return (
    <div className="flex items-center gap-3 pt-1 pb-2">
      <div className={`h-4 w-4 rounded-full ${dotBg} shrink-0 ring-4 ring-background`} />
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-display font-bold text-sm tracking-tight">{entry.label}</span>
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${dotBg} text-white`}
        >
          {chamberLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Group consecutive events with the same label into a single entry with count + date range.
 * e.g. 15x "Discussion en séance publique" → 1 row with "15 séances, 12 mai - 22 mai 2025"
 */
interface GroupedEvent {
  label: string;
  code: string;
  chamber: string;
  dates: string[];
  count: number;
}

function groupConsecutiveEvents(events: FlatEntry[]): GroupedEvent[] {
  const groups: GroupedEvent[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.label === event.label) {
      if (event.date) last.dates.push(event.date);
      last.count++;
    } else {
      groups.push({
        label: event.label,
        code: event.code,
        chamber: event.chamber,
        dates: event.date ? [event.date] : [],
        count: 1,
      });
    }
  }
  return groups;
}

function formatDateRange(dates: string[]): string | null {
  if (dates.length === 0) return null;
  if (dates.length === 1) return formatDate(dates[0]!);
  const sorted = [...dates].sort();
  return `${formatDate(sorted[0]!)} - ${formatDate(sorted[sorted.length - 1]!)}`;
}

/**
 * Individual event within a phase — a dated legislative act (possibly grouped).
 */
function EventRow({ group, isLast }: { group: GroupedEvent; isLast: boolean }) {
  const dateDisplay =
    group.count > 1 ? formatDateRange(group.dates) : formatDate(group.dates[0] ?? null);

  return (
    <div className={`flex items-start gap-3 ml-[7px] ${isLast ? "" : "pb-3"}`}>
      {/* Small dot on the line */}
      <div className="relative flex flex-col items-center shrink-0">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 ring-2 ring-background mt-1.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm leading-snug">{group.label}</span>
        {group.count > 1 && (
          <span className="text-xs font-medium text-muted-foreground">({group.count} séances)</span>
        )}
        {dateDisplay && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{dateDisplay}</span>
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
        <div className="space-y-1">
          {sorted.map((phase, i) => {
            const lineColor = CHAMBER_LINE_COLORS[phase.chamber] || CHAMBER_LINE_COLORS.UNKNOWN;

            // Get flattened dated events from this phase
            const events = flattenEntries(phase.children || []);

            return (
              <div
                key={`${phase.code}-${i}`}
                className={`relative ${i < sorted.length - 1 ? "pb-4" : ""}`}
              >
                {/* Phase header */}
                <PhaseHeader entry={phase} />

                {/* Events list with colored left border */}
                {events.length > 0 &&
                  (() => {
                    const grouped = groupConsecutiveEvents(events);
                    return (
                      <div className={`ml-[7px] border-l-2 ${lineColor} pl-5 mt-1 space-y-0`}>
                        {grouped.map((group, j) => (
                          <EventRow
                            key={`${group.code}-${j}`}
                            group={group}
                            isLast={j === grouped.length - 1}
                          />
                        ))}
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
