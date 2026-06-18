"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  /** Param key, used for removal */
  key: string;
  /** Human-readable label shown in the chip */
  label: string;
  /** Optional raw value, kept for future needs (not required for removal) */
  value?: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  className?: string;
  /** Leading label (default: "Filtres actifs :") */
  label?: string;
}

export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
  className,
  label = "Filtres actifs :",
}: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/40 pl-3 pr-1 py-0.5"
        >
          {f.label}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Retirer le filtre ${f.label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="ml-1 text-primary hover:underline">
        Tout effacer
      </button>
    </div>
  );
}
