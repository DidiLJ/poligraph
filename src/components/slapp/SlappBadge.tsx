import { ShieldAlert } from "lucide-react";

interface SlappBadgeProps {
  qualificationRule?: "3of5" | "criterion5_only" | null;
  className?: string;
}

export function SlappBadge({ qualificationRule, className }: SlappBadgeProps) {
  const tooltip =
    qualificationRule === "criterion5_only"
      ? "Affaire qualifiée SLAPP par un tiers identifié (RSF, Article 19, CASE Coalition, etc.)"
      : "Affaire qualifiée SLAPP selon la règle 3 critères sur 5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 ${
        className ?? ""
      }`}
      title={tooltip}
      role="status"
    >
      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
      Procédure-bâillon
    </span>
  );
}
