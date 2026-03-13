"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput, SelectFilter } from "@/components/filters";
import { FilterBarShell } from "@/components/filters/FilterBarShell";
import { AFFAIR_STATUS_LABELS, AFFAIR_SEVERITY_EDITORIAL } from "@/config/labels";
import type { AffairStatus, AffairSeverity } from "@/types";

interface AffairesFilterBarProps {
  currentFilters: {
    search: string;
    sort: string;
    severity: string;
    parti: string;
    status: string;
    supercat: string;
  };
  parties: Array<{
    slug: string;
    shortName: string;
    name: string;
    count: number;
  }>;
  severityCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

const SORT_OPTIONS: Record<string, string> = {
  "": "Pertinence",
  "date-desc": "Plus récentes",
  "date-asc": "Plus anciennes",
};

const STATUS_GROUPS: { label: string; statuses: AffairStatus[] }[] = [
  {
    label: "── Condamnations ──",
    statuses: ["CONDAMNATION_DEFINITIVE", "CONDAMNATION_PREMIERE_INSTANCE", "APPEL_EN_COURS"],
  },
  {
    label: "── Procédures ──",
    statuses: ["INSTRUCTION", "MISE_EN_EXAMEN", "RENVOI_TRIBUNAL", "PROCES_EN_COURS"],
  },
  {
    label: "── Enquêtes ──",
    statuses: ["ENQUETE_PRELIMINAIRE"],
  },
  {
    label: "── Classées ──",
    statuses: ["RELAXE", "ACQUITTEMENT", "NON_LIEU", "PRESCRIPTION", "CLASSEMENT_SANS_SUITE"],
  },
];

export function AffairesFilterBar({
  currentFilters,
  parties,
  severityCounts,
  statusCounts,
}: AffairesFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  const statusOptions = [
    { value: "", label: "Tous les statuts" },
    ...STATUS_GROUPS.flatMap((group) => {
      const groupStatuses = group.statuses.filter((s) => (statusCounts[s] || 0) > 0);
      if (groupStatuses.length === 0) return [];
      return [
        { value: `sep-${group.label}`, label: group.label, disabled: true },
        ...groupStatuses.map((s) => ({
          value: s,
          label: `${AFFAIR_STATUS_LABELS[s]} (${statusCounts[s] || 0})`,
        })),
      ];
    }),
  ];

  const severityOptions = [
    { value: "", label: "Toutes" },
    ...(Object.keys(AFFAIR_SEVERITY_EDITORIAL) as AffairSeverity[]).map((sev) => ({
      value: sev,
      label: `${AFFAIR_SEVERITY_EDITORIAL[sev]} (${severityCounts[sev] || 0})`,
    })),
  ];

  const partyOptions = [
    { value: "", label: "Tous les partis" },
    ...parties.map((p) => ({
      value: p.slug,
      label: `${p.shortName} — ${p.name} (${p.count})`,
    })),
  ];

  const sortOptions = Object.entries(SORT_OPTIONS).map(([value, label]) => ({ value, label }));

  return (
    <FilterBarShell isPending={isPending} className="space-y-3">
      {/* Search input */}
      <DebouncedSearchInput
        id="search-affairs"
        value={currentFilters.search}
        onSearch={(v) => updateParams({ search: v })}
        placeholder="Rechercher une affaire..."
        label="Recherche"
      />

      {/* Dropdowns grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SelectFilter
          id="sort-affairs"
          label="Trier par"
          value={currentFilters.sort}
          onChange={(v) => updateParams({ sort: v })}
          options={sortOptions}
        />

        <SelectFilter
          id="parti-affairs"
          label="Parti"
          value={currentFilters.parti}
          onChange={(v) => updateParams({ parti: v })}
          options={partyOptions}
        />

        <SelectFilter
          id="severity-affairs"
          label="Gravité"
          value={currentFilters.severity}
          onChange={(v) => updateParams({ severity: v })}
          options={severityOptions}
        />

        <SelectFilter
          id="status-affairs"
          label="Statut"
          value={currentFilters.status}
          onChange={(v) => updateParams({ status: v })}
          options={statusOptions}
        />
      </div>
    </FilterBarShell>
  );
}
