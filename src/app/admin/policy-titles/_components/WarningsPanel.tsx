import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GenerationWarning } from "@/services/scrutin-policy-title/types";

const SEVERITY_LABELS: Record<string, string> = {
  blocker: "bloquant",
  warn: "avertissement",
  info: "info",
};

function WarningItem({ warning }: { warning: GenerationWarning }) {
  const isBlocker = warning.severity === "blocker";
  const isSubTarget = warning.code === "SUB_TARGET_NOT_CITED";
  return (
    <li
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        isSubTarget
          ? "border-2 border-red-500 bg-red-50 text-red-900"
          : isBlocker
            ? "border-red-300 bg-red-50 text-red-800"
            : warning.severity === "warn"
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-muted bg-muted/30 text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{warning.code}</span>
        <span
          className={cn(
            "text-[11px] uppercase tracking-wide",
            isBlocker ? "font-semibold text-red-700" : "opacity-70"
          )}
        >
          {SEVERITY_LABELS[warning.severity] ?? warning.severity}
        </span>
      </div>
      <p className="mt-0.5">{warning.message}</p>
    </li>
  );
}

function Column({ title, warnings }: { title: string; warnings: GenerationWarning[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {warnings.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Aucun avertissement.</p>
      ) : (
        <ul className="space-y-2">
          {warnings.map((w, i) => (
            <WarningItem key={`${w.code}-${i}`} warning={w} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function WarningsPanel({
  generationWarnings,
  currentWarnings,
}: {
  generationWarnings: GenerationWarning[];
  currentWarnings: GenerationWarning[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avertissements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Column title="Avertissements à la génération" warnings={generationWarnings} />
          <Column title="Avertissements actuels" warnings={currentWarnings} />
        </div>
      </CardContent>
    </Card>
  );
}
