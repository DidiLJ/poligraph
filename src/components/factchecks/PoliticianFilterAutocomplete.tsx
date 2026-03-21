// src/components/factchecks/PoliticianFilterAutocomplete.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn, normalizeImageUrl } from "@/lib/utils";
import { MANDATE_TYPE_LABELS } from "@/config/labels";

interface SearchResult {
  id: string;
  fullName: string;
  slug: string;
  photoUrl: string | null;
  party: string | null;
  partyColor: string | null;
  mandate: string | null;
}

interface PoliticianFilterAutocompleteProps {
  onSelect: (slug: string) => void;
  selectedSlug?: string;
}

function ResultAvatar({ photoUrl, fullName }: { photoUrl: string | null; fullName: string }) {
  const [hasError, setHasError] = useState(false);
  const normalizedUrl = normalizeImageUrl(photoUrl);

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (!normalizedUrl || hasError) {
    return (
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground">{initials}</span>
      </div>
    );
  }

  return (
    <div className="w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={normalizedUrl}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function PoliticianFilterAutocomplete({
  onSelect,
  selectedSlug,
}: PoliticianFilterAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search/politicians?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setResults(data);
        setIsOpen(data.length > 0);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setQuery("");
      setIsOpen(false);
      onSelect(result.slug);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Show a static label when a politician is already selected (banner handles display)
  if (selectedSlug) {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Politicien</label>
        <div className="h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-muted-foreground flex items-center">
          Sélectionné ✓
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor="politician-factchecks"
        className="text-xs font-medium text-muted-foreground mb-1 block"
      >
        Politicien
      </label>
      <div className="relative">
        <input
          id="politician-factchecks"
          type="search"
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Chercher..."
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
          autoComplete="off"
          aria-expanded={isOpen}
          aria-controls="politician-filter-results"
          aria-autocomplete="list"
          aria-activedescendant={
            selectedIndex >= 0 ? `politician-result-${selectedIndex}` : undefined
          }
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          id="politician-filter-results"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <ul className="py-1">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  id={`politician-result-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full px-3 py-2 flex items-center gap-2 text-left transition-colors",
                    index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <ResultAvatar photoUrl={result.photoUrl} fullName={result.fullName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{result.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.mandate &&
                        (MANDATE_TYPE_LABELS[result.mandate as keyof typeof MANDATE_TYPE_LABELS] ||
                          result.mandate)}
                      {result.mandate && result.party && " - "}
                      {result.party && (
                        <span
                          style={{ color: result.partyColor || undefined }}
                          className="font-medium"
                        >
                          {result.party}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
