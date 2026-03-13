"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, AlertTriangle } from "lucide-react";
import { INVOLVEMENT_LABELS } from "@/config/labels";
import type { Involvement } from "@/generated/prisma";

interface LinkedAffair {
  id: string;
  title: string;
  slug: string;
  involvement: Involvement;
  linkedAffairId: string | null;
  politician: { id: string; fullName: string; slug: string };
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
  currentInvolvement?: Involvement;
}

export function LinkedAffairSelect({ value, onChange, excludeId, currentInvolvement }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedAffair[]>([]);
  const [selected, setSelected] = useState<LinkedAffair | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value && !selected) {
      fetch(`/api/admin/affaires/search?id=${value}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.results[0]) setSelected(data.results[0]);
        });
    }
  }, [value, selected]);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const params = new URLSearchParams({ q });
      if (excludeId) params.set("excludeId", excludeId);
      const res = await fetch(`/api/admin/affaires/search?${params}`);
      const data = await res.json();
      setResults(data.results);
    },
    [excludeId]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (affair: LinkedAffair) => {
    setSelected(affair);
    onChange(affair.id);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    setSelected(null);
    onChange(null);
  };

  const showSameInvolvementWarning =
    selected && currentInvolvement && selected.involvement === currentInvolvement;
  const showChainWarning = selected && selected.linkedAffairId !== null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Affaire liee (optionnel)</label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <div className="flex-1 text-sm">
            <p className="font-medium">{selected.title}</p>
            <p className="text-muted-foreground">
              {selected.politician.fullName} - {INVOLVEMENT_LABELS[selected.involvement]}
            </p>
          </div>
          <button type="button" onClick={handleClear} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Rechercher une affaire par titre..."
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
          />
          {isOpen && results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover shadow-md">
              {results.map((affair) => (
                <li key={affair.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(affair)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <p className="font-medium">{affair.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {affair.politician.fullName} - {INVOLVEMENT_LABELS[affair.involvement]}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {showSameInvolvementWarning && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Les deux affaires ont le meme role ({INVOLVEMENT_LABELS[currentInvolvement]}). Verifiez la
          coherence.
        </div>
      )}
      {showChainWarning && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Cette affaire est deja liee a une autre affaire. Lier creera une chaine.
        </div>
      )}
    </div>
  );
}
