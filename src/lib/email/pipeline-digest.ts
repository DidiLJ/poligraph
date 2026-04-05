/**
 * Pipeline Health Digest
 *
 * Pure functions to build pipeline health email digests.
 * No side effects - email sending is handled by the caller (Inngest function).
 */

import type { PipelineHealthStatus } from "@/config/pipeline-registry";

// ─── Types ──────────────────────────────────────────────────────

export interface DigestPipeline {
  pipelineId: string;
  pipelineName: string;
  status: PipelineHealthStatus;
  hoursSinceLastRun: number | null;
  lastError: string | null;
}

export interface DigestInput {
  pipelines: DigestPipeline[];
  now: Date;
}

export interface DigestOutput {
  subject: string;
  text: string;
}

// ─── Pure functions ─────────────────────────────────────────────

/**
 * Whether the digest should actually be sent (skip when all healthy).
 */
export function shouldSendDigest(input: DigestInput): boolean {
  return input.pipelines.some((p) => p.status === "critical" || p.status === "warning");
}

/**
 * Build plain-text email content for the pipeline digest.
 */
export function buildPipelineDigestText(input: DigestInput): DigestOutput {
  const { pipelines, now } = input;

  const critical = pipelines.filter((p) => p.status === "critical");
  const warning = pipelines.filter((p) => p.status === "warning");
  const healthy = pipelines.filter((p) => p.status === "healthy");
  const total = pipelines.length;

  const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  // Subject
  const parts: string[] = [];
  if (critical.length > 0)
    parts.push(`${critical.length} critique${critical.length > 1 ? "s" : ""}`);
  if (warning.length > 0) parts.push(`${warning.length} en retard`);
  const subject =
    parts.length > 0
      ? `[Poligraph] Pipelines ${dateStr} : ${parts.join(", ")}`
      : `[Poligraph] Pipelines ${dateStr} : tout OK`;

  // Body
  const lines: string[] = [];
  lines.push(`Rapport pipelines Poligraph - ${dateStr}`);
  lines.push(`${"=".repeat(45)}`);
  lines.push("");

  if (critical.length === 0 && warning.length === 0) {
    lines.push(`Tous les pipelines sont OK (${healthy.length}/${total}).`);
    lines.push("");
  }

  if (critical.length > 0) {
    lines.push("CRITIQUE");
    lines.push("-".repeat(20));
    for (const p of critical) {
      lines.push(`  ${p.pipelineName} - ${formatHoursCompact(p.hoursSinceLastRun)}`);
      if (p.lastError) {
        lines.push(`    Erreur : ${p.lastError.slice(0, 200)}`);
      }
    }
    lines.push("");
  }

  if (warning.length > 0) {
    lines.push("RETARD");
    lines.push("-".repeat(20));
    for (const p of warning) {
      lines.push(`  ${p.pipelineName} - ${formatHoursCompact(p.hoursSinceLastRun)}`);
    }
    lines.push("");
  }

  if (healthy.length > 0) {
    lines.push(`OK : ${healthy.length}/${total} pipelines`);
    lines.push("");
  }

  lines.push("---");
  lines.push("https://poligraph.fr/admin/pipelines");

  return { subject, text: lines.join("\n") };
}

// ─── Helpers ────────────────────────────────────────────────────

function formatHoursCompact(hours: number | null): string {
  if (hours === null) return "jamais";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  if (rem === 0) return `${days}j`;
  return `${days}j ${rem}h`;
}
