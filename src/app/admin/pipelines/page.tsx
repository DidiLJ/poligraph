import { getPipelineHealthAll, getPipelinesSummary } from "@/lib/data/pipelines";
import type { PipelineCategory, PipelineHealthStatus } from "@/config/pipeline-registry";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Ban,
  Clock,
  Activity,
} from "lucide-react";
import Link from "next/link";

export const revalidate = 300;

// ─── Status visual config ───────────────────────────────────────

const STATUS_ICON: Record<PipelineHealthStatus, React.ComponentType<{ className?: string }>> = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  unknown: HelpCircle,
  disabled: Ban,
};

const STATUS_COLORS: Record<PipelineHealthStatus, string> = {
  healthy: "text-emerald-600",
  warning: "text-amber-600",
  critical: "text-red-600",
  unknown: "text-gray-400",
  disabled: "text-gray-300",
};

const STATUS_BG: Record<PipelineHealthStatus, string> = {
  healthy: "bg-emerald-50 border-emerald-200",
  warning: "bg-amber-50 border-amber-200",
  critical: "bg-red-50 border-red-200",
  unknown: "bg-gray-50 border-gray-200",
  disabled: "bg-gray-50 border-gray-100",
};

const STATUS_LABELS: Record<PipelineHealthStatus, string> = {
  healthy: "OK",
  warning: "Retard",
  critical: "Critique",
  unknown: "Inconnu",
  disabled: "Désactivé",
};

const CATEGORY_LABELS: Record<PipelineCategory, string> = {
  politicians: "Politiques",
  votes: "Scrutins & Législation",
  content: "Contenu",
  enrichment: "Enrichissement",
  elections: "Élections",
};

const CATEGORY_ORDER: PipelineCategory[] = [
  "politicians",
  "votes",
  "content",
  "enrichment",
  "elections",
];

// ─── Helpers ────────────────────────────────────────────────────

function formatHours(hours: number | null): string {
  if (hours === null) return "jamais";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  if (remHours === 0) return `${days}j`;
  return `${days}j ${remHours}h`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}m${sec > 0 ? ` ${sec}s` : ""}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "jamais";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ───────────────────────────────────────────────────────

export default async function PipelinesPage() {
  const [healthAll, summary] = await Promise.all([getPipelineHealthAll(), getPipelinesSummary()]);

  // Group by category
  const byCategory = new Map<PipelineCategory, typeof healthAll>();
  for (const h of healthAll) {
    const cat = h.pipeline.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(h);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Santé des pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d{"'"}ensemble de l{"'"}état de tous les pipelines de synchronisation
          </p>
        </div>
        <Link
          href="/admin/syncs"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Activity className="w-3.5 h-3.5" aria-hidden="true" />
          Lancer un sync
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="OK"
          count={summary.healthy}
          total={summary.total}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <SummaryCard
          label="Retard"
          count={summary.warning}
          total={summary.total}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <SummaryCard
          label="Critique"
          count={summary.critical}
          total={summary.total}
          color="text-red-600"
          bg="bg-red-50"
        />
        <SummaryCard
          label="Inconnu"
          count={summary.unknown + summary.disabled}
          total={summary.total}
          color="text-gray-500"
          bg="bg-gray-50"
        />
      </div>

      {/* Pipeline list by category */}
      {CATEGORY_ORDER.map((cat) => {
        const pipelines = byCategory.get(cat);
        if (!pipelines?.length) return null;

        return (
          <div key={cat}>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {CATEGORY_LABELS[cat]}
            </h2>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {pipelines.map((h) => {
                  const StatusIcon = STATUS_ICON[h.status];
                  return (
                    <div
                      key={h.pipeline.id}
                      className={`flex items-center gap-4 px-4 py-3 ${h.status === "critical" ? "bg-red-50/30" : ""}`}
                    >
                      <StatusIcon
                        className={`w-5 h-5 shrink-0 ${STATUS_COLORS[h.status]}`}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{h.pipeline.name}</span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full border ${STATUS_BG[h.status]}`}
                          >
                            {STATUS_LABELS[h.status]}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                            {h.pipeline.frequency}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {formatDate(h.lastRunAt)}
                          </span>
                          {h.hoursSinceLastRun !== null && (
                            <span className="tabular-nums">
                              il y a {formatHours(h.hoursSinceLastRun)}
                            </span>
                          )}
                          {h.lastDurationS !== null && (
                            <span className="tabular-nums">{formatDuration(h.lastDurationS)}</span>
                          )}
                          {h.lastItemCount !== null && (
                            <span className="tabular-nums">
                              {h.lastItemCount.toLocaleString("fr-FR")} items
                            </span>
                          )}
                        </div>
                      </div>
                      {h.lastError && (
                        <span
                          className="text-xs text-red-600 max-w-[200px] truncate"
                          title={h.lastError}
                        >
                          {h.lastError}
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  total,
  color,
  bg,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{count}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {label} <span className="text-muted-foreground/50">/ {total}</span>
        </div>
        <div className={`h-1.5 rounded-full ${bg} mt-2 overflow-hidden`}>
          <div
            className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
            style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
