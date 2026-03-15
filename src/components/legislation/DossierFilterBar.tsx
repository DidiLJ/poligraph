"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { SelectFilter } from "@/components/filters";
import { FilterBarShell } from "@/components/filters/FilterBarShell";
import { DOSSIER_STATUS_LABELS, THEME_CATEGORY_LABELS } from "@/config/labels";
import type { DossierStatus, ThemeCategory } from "@/generated/prisma";

interface DossierFilterBarProps {
  currentFilters: {
    status: string;
    theme: string;
    sort: string;
  };
  statusCounts: Record<string, number>;
  themeCounts: Array<{ theme: ThemeCategory; count: number }>;
}

const SORT_OPTIONS: Record<string, string> = {
  "": "Date de dépôt",
  updated: "Dernière mise à jour",
  status: "Par statut",
};

export function DossierFilterBar({
  currentFilters,
  statusCounts,
  themeCounts,
}: DossierFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  const statusOptions = [
    { value: "", label: "Tous les statuts" },
    ...(Object.keys(DOSSIER_STATUS_LABELS) as DossierStatus[])
      .filter((s) => (statusCounts[s] || 0) > 0)
      .map((s) => ({
        value: s,
        label: `${DOSSIER_STATUS_LABELS[s]} (${statusCounts[s] || 0})`,
      })),
  ];

  const themeOptions = [
    { value: "", label: "Tous les thèmes" },
    ...themeCounts.map((t) => ({
      value: t.theme,
      label: `${THEME_CATEGORY_LABELS[t.theme]} (${t.count})`,
    })),
  ];

  const sortOptions = Object.entries(SORT_OPTIONS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <FilterBarShell isPending={isPending}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SelectFilter
          id="status-dossier"
          label="Statut"
          value={currentFilters.status}
          onChange={(v) => updateParams({ status: v })}
          options={statusOptions}
        />

        <SelectFilter
          id="theme-dossier"
          label="Thème"
          value={currentFilters.theme}
          onChange={(v) => updateParams({ theme: v })}
          options={themeOptions}
        />

        <SelectFilter
          id="sort-dossier"
          label="Trier par"
          value={currentFilters.sort}
          onChange={(v) => updateParams({ sort: v })}
          options={sortOptions}
        />
      </div>
    </FilterBarShell>
  );
}
