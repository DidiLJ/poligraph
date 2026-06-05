import { cn } from "@/lib/utils";
import type { GenerationWarning, QualitySignals } from "@/services/scrutin-policy-title/types";

type ChipColor = "green" | "amber" | "red";

const COLOR_CLASS: Record<ChipColor, string> = {
  green: "border-green-300 bg-green-50 text-green-800",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  red: "border-red-300 bg-red-50 text-red-800",
};

const DEPTH_LABELS: Record<string, string> = {
  subAmendment: "Sous-amendement",
  amendment: "Amendement",
  exposeDesMotifs: "Exposé des motifs",
};

function Chip({ color, label, value }: { color: ChipColor; label: string; value: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm",
        COLOR_CLASS[color]
      )}
      aria-label={`${label} : ${value}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function confidenceColor(confidence: string): ChipColor {
  if (confidence === "HIGH") return "green";
  if (confidence === "MEDIUM") return "amber";
  return "red";
}

function depthColor(depth: string | null): ChipColor {
  if (depth === "subAmendment" || depth === "amendment") return "green";
  if (depth === "exposeDesMotifs") return "amber";
  return "red";
}

function coverageColor(coverage: number): ChipColor {
  if (coverage >= 0.6) return "green";
  if (coverage >= 0.3) return "amber";
  return "red";
}

export function ReviewHealthBanner({
  confidence,
  qualitySignals,
  currentWarnings,
}: {
  confidence: string;
  qualitySignals: QualitySignals;
  currentWarnings: GenerationWarning[];
}) {
  const blockerCount = currentWarnings.filter((w) => w.severity === "blocker").length;
  const warningCount = currentWarnings.filter((w) => w.severity === "warn").length;
  const depth = qualitySignals.substanceDepth;
  const coverage = qualitySignals.evidenceCoverage ?? 0;

  const allGreen =
    confidenceColor(confidence) === "green" &&
    depthColor(depth) === "green" &&
    blockerCount === 0 &&
    warningCount === 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Chip color={confidenceColor(confidence)} label="Confiance" value={confidence} />
        <Chip
          color={depthColor(depth)}
          label="Profondeur"
          value={depth ? (DEPTH_LABELS[depth] ?? depth) : "Aucune"}
        />
        <Chip
          color={coverageColor(coverage)}
          label="Recoupement"
          value={`${Math.round(coverage * 100)} %`}
        />
        <Chip
          color={blockerCount > 0 ? "red" : "green"}
          label="Bloquants"
          value={String(blockerCount)}
        />
        <Chip
          color={warningCount > 0 ? "amber" : "green"}
          label="Avertissements"
          value={String(warningCount)}
        />
      </div>
      {allGreen ? (
        <p className="text-sm font-medium text-green-700" role="status">
          Tous les indicateurs sont au vert : titre prêt à être examiné.
        </p>
      ) : null}
    </div>
  );
}
