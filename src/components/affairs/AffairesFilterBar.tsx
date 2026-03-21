"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput, SelectFilter } from "@/components/filters";
import { FilterBarShell } from "@/components/filters/FilterBarShell";
import {
  AFFAIR_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_LABELS,
  getCategoriesForSuper,
  type AffairSuperCategory,
} from "@/config/labels";
import { CERTAINTY_LABELS, type CertaintyLevel } from "@/config/certainty";
import type { AffairCategory } from "@/types";

interface AffairesFilterBarProps {
  currentFilters: {
    search: string;
    sort: string;
    certainty: string;
    parti: string;
    category: string;
    supercat: string;
  };
  parties: Array<{
    slug: string;
    shortName: string;
    name: string;
    count: number;
  }>;
  certaintyCounts: Record<string, number>;
  superCounts: Record<string, number>;
}

const SORT_OPTIONS: Record<string, string> = {
  "": "Pertinence",
  certainty: "Par certitude",
  "date-desc": "Plus récentes",
  "date-asc": "Plus anciennes",
  "name-asc": "Nom A-Z",
  "name-desc": "Nom Z-A",
};

const SUPER_CATEGORIES: AffairSuperCategory[] = [
  "PROBITE",
  "FINANCES",
  "PERSONNES",
  "EXPRESSION",
  "AUTRE",
];

export function AffairesFilterBar({
  currentFilters,
  parties,
  certaintyCounts,
  superCounts,
}: AffairesFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  const certaintyOptions = [
    { value: "", label: "Toutes les certitudes" },
    ...(Object.keys(CERTAINTY_LABELS) as CertaintyLevel[]).map((level) => ({
      value: level,
      label: `${CERTAINTY_LABELS[level]} (${certaintyCounts[level] || 0})`,
    })),
  ];

  const superCatOptions = [
    { value: "", label: "Toutes les familles" },
    ...SUPER_CATEGORIES.map((superCat) => ({
      value: superCat,
      label: `${AFFAIR_SUPER_CATEGORY_LABELS[superCat]} (${superCounts[superCat] || 0})`,
    })),
  ];

  const categoryOptions = [
    { value: "", label: "Toutes les infractions" },
    ...SUPER_CATEGORIES.flatMap((superCat) => {
      const cats = getCategoriesForSuper(superCat);
      if (cats.length === 0) return [];
      return [
        {
          value: `sep-${superCat}`,
          label: `── ${AFFAIR_SUPER_CATEGORY_LABELS[superCat]} ──`,
          disabled: true,
        },
        ...cats.map((cat: AffairCategory) => ({
          value: cat,
          label: AFFAIR_CATEGORY_LABELS[cat],
        })),
      ];
    }),
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

      {/* Dropdowns grid: 2 cols mobile, 5 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SelectFilter
          id="supercat-affairs"
          label="Famille"
          value={currentFilters.supercat}
          onChange={(v) => updateParams({ supercat: v, category: "" })}
          options={superCatOptions}
        />

        <SelectFilter
          id="category-affairs"
          label="Infraction"
          value={currentFilters.category}
          onChange={(v) => updateParams({ category: v })}
          options={categoryOptions}
        />

        <SelectFilter
          id="certainty-affairs"
          label="Certitude"
          value={currentFilters.certainty}
          onChange={(v) => updateParams({ certainty: v })}
          options={certaintyOptions}
        />

        <SelectFilter
          id="parti-affairs"
          label="Parti"
          value={currentFilters.parti}
          onChange={(v) => updateParams({ parti: v })}
          options={partyOptions}
        />

        <SelectFilter
          id="sort-affairs"
          label="Trier par"
          value={currentFilters.sort}
          onChange={(v) => updateParams({ sort: v })}
          options={sortOptions}
        />
      </div>
    </FilterBarShell>
  );
}
