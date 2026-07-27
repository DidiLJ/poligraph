"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput, SelectFilter, ActiveFilterChips } from "@/components/filters";
import type { ActiveFilter } from "@/components/filters";
import { FilterBarShell } from "@/components/filters/FilterBarShell";
import {
  AFFAIR_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_LABELS,
  CATEGORY_TO_SUPER,
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
  "": "Plus récentes",
  certainty: "Par certitude",
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
  // Utility filters use replace so they do not stack browser history.
  const set = (updates: Record<string, string>) => updateParams(updates, { mode: "replace" });

  // Category-first: the displayed family is the family of the selected
  // infraction when one is set. This keeps a legacy ?category= URL (no supercat)
  // coherent and never hides the active infraction.
  const effectiveSupercat = ((currentFilters.category
    ? CATEGORY_TO_SUPER[currentFilters.category as AffairCategory]
    : currentFilters.supercat) || "") as AffairSuperCategory | "";

  const certaintyOptions = [
    { value: "", label: "Toutes les certitudes" },
    ...(Object.keys(CERTAINTY_LABELS) as CertaintyLevel[])
      .filter((level) => (certaintyCounts[level] || 0) > 0)
      .map((level) => ({
        value: level,
        label: `${CERTAINTY_LABELS[level]} (${certaintyCounts[level] || 0})`,
      })),
  ];

  const superCatOptions = [
    { value: "", label: "Toutes les catégories" },
    ...SUPER_CATEGORIES.map((superCat) => ({
      value: superCat,
      label: `${AFFAIR_SUPER_CATEGORY_LABELS[superCat]} (${superCounts[superCat] || 0})`,
    })),
  ];

  // Infraction options are scoped to the effective family (no separators).
  const categoryOptions = effectiveSupercat
    ? [
        { value: "", label: "Toutes les infractions" },
        ...getCategoriesForSuper(effectiveSupercat).map((cat) => ({
          value: cat,
          label: AFFAIR_CATEGORY_LABELS[cat],
        })),
      ]
    : [{ value: "", label: "Choisir d'abord une catégorie" }];

  const sortOptions = Object.entries(SORT_OPTIONS).map(([value, label]) => ({ value, label }));

  // Active filter chips. `mode` is a perimeter tab (not a chip); `sort` IS shown
  // so that "Tout effacer" never resets an invisible state.
  const activeFilters: ActiveFilter[] = [];
  if (currentFilters.search) {
    activeFilters.push({ key: "search", label: `Recherche : ${currentFilters.search}` });
  }
  if (currentFilters.parti) {
    const party = parties.find((p) => p.slug === currentFilters.parti);
    activeFilters.push({
      key: "parti",
      label: `Parti : ${party?.shortName ?? currentFilters.parti}`,
    });
  }
  if (currentFilters.supercat) {
    // Suppress a stale family chip that would contradict the selected infraction
    // (incoherent ?supercat=A&category=B URL). Category prevails in the UI.
    const consistent =
      !currentFilters.category ||
      CATEGORY_TO_SUPER[currentFilters.category as AffairCategory] === currentFilters.supercat;
    if (consistent) {
      activeFilters.push({
        key: "supercat",
        label:
          AFFAIR_SUPER_CATEGORY_LABELS[currentFilters.supercat as AffairSuperCategory] ??
          currentFilters.supercat,
      });
    }
  }
  if (currentFilters.certainty) {
    activeFilters.push({
      key: "certainty",
      label:
        CERTAINTY_LABELS[currentFilters.certainty as CertaintyLevel] ?? currentFilters.certainty,
    });
  }
  if (currentFilters.category) {
    activeFilters.push({
      key: "category",
      label:
        AFFAIR_CATEGORY_LABELS[currentFilters.category as AffairCategory] ??
        currentFilters.category,
    });
  }
  if (currentFilters.sort) {
    activeFilters.push({
      key: "sort",
      label: `Tri : ${SORT_OPTIONS[currentFilters.sort] ?? currentFilters.sort}`,
    });
  }

  const removeFilter = (key: string) =>
    key === "supercat" ? set({ supercat: "", category: "" }) : set({ [key]: "" });

  const clearAll = () =>
    set({ search: "", supercat: "", category: "", certainty: "", parti: "", sort: "" });

  return (
    <FilterBarShell isPending={isPending} className="space-y-3">
      {/* Search input — manual: applies on submit (button/Enter), not while typing */}
      <DebouncedSearchInput
        id="search-affairs"
        value={currentFilters.search}
        onSearch={(v) => set({ search: v })}
        manual
        placeholder="Rechercher une affaire..."
        label="Recherche"
      />

      {/* Dropdowns grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SelectFilter
          id="supercat-affairs"
          label="Catégorie d'infraction"
          value={effectiveSupercat}
          onChange={(v) => set({ supercat: v, category: "" })}
          options={superCatOptions}
        />

        <SelectFilter
          id="category-affairs"
          label="Infraction précise"
          value={currentFilters.category}
          onChange={(v) => set({ supercat: effectiveSupercat, category: v })}
          options={categoryOptions}
          disabled={!effectiveSupercat}
        />

        <SelectFilter
          id="certainty-affairs"
          label="Certitude"
          value={currentFilters.certainty}
          onChange={(v) => set({ certainty: v })}
          options={certaintyOptions}
        />

        <SelectFilter
          id="sort-affairs"
          label="Trier par"
          value={currentFilters.sort}
          onChange={(v) => set({ sort: v })}
          options={sortOptions}
        />
      </div>

      <ActiveFilterChips filters={activeFilters} onRemove={removeFilter} onClearAll={clearAll} />
    </FilterBarShell>
  );
}
