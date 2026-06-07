"use client";

import { useState, useTransition } from "react";
import { PublicationStatus } from "@/generated/prisma";

const STATUS_OPTIONS: { value: PublicationStatus; label: string }[] = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "PUBLISHED", label: "Publié" },
  { value: "REJECTED", label: "Rejeté" },
  { value: "ARCHIVED", label: "Archivé" },
  { value: "EXCLUDED", label: "Exclu" },
];

const STATUS_STYLES: Record<PublicationStatus, string> = {
  DRAFT: "border-amber-300 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-300 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-300 bg-red-50 text-red-700",
  ARCHIVED: "border-slate-300 bg-slate-50 text-slate-500",
  EXCLUDED: "border-gray-300 bg-gray-50 text-gray-500",
};

interface PublicationStatusSelectProps {
  entityId: string;
  entityType: "affair" | "politician" | "factcheck";
  currentStatus: PublicationStatus;
  /** L'action peut retourner un refus structuré ({ ok: false, error }) à afficher. */
  onChange: (
    id: string,
    status: PublicationStatus
  ) => Promise<void | { ok: boolean; error?: string }>;
}

export function PublicationStatusSelect({
  entityId,
  currentStatus,
  onChange,
}: PublicationStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={currentStatus}
        disabled={isPending}
        aria-label="Statut de publication"
        className={`h-8 rounded-md border px-2 text-sm font-medium cursor-pointer appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${STATUS_STYLES[currentStatus]} ${isPending ? "opacity-50 cursor-wait" : ""}`}
        onChange={(e) => {
          const newStatus = e.target.value as PublicationStatus;
          if (newStatus === currentStatus) return;
          setError(null);
          startTransition(async () => {
            const result = await onChange(entityId, newStatus);
            if (result && result.ok === false) {
              setError(result.error ?? "La mise à jour a échoué");
            }
          });
        }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
