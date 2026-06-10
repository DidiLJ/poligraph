"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { useCommandPalette } from "@/components/search";

const PLACEHOLDER = "Rechercher un représentant, un vote, une affaire";

// Hydration detection via useSyncExternalStore: server returns false, client
// returns true. Snapshots are stable primitives, so no re-render loop.
const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Progressive-enhancement search field for the homepage hero.
 *
 * Before hydration (and with JavaScript disabled) it renders a real GET form
 * targeting /recherche, so the search works for crawlers and no-JS users.
 * Once hydrated it swaps to a trigger that opens the global command palette
 * for instant results. The initial client render matches the SSR markup,
 * so there is no hydration mismatch.
 */
export function HomeHeroSearch() {
  const { open } = useCommandPalette();
  const enhanced = useHydrated();

  if (enhanced) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={PLACEHOLDER}
        className="group flex h-12 w-full items-center gap-3 rounded-xl border bg-card pl-4 pr-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40"
      >
        <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">{PLACEHOLDER}</span>
        <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>
    );
  }

  return (
    <form action="/recherche" method="get" role="search" className="relative w-full">
      <label htmlFor="home-hero-search" className="sr-only">
        {PLACEHOLDER}
      </label>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id="home-hero-search"
        name="q"
        type="search"
        placeholder={PLACEHOLDER}
        autoComplete="off"
        className="h-12 w-full rounded-xl border bg-card pl-12 pr-4 text-sm outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
      <button type="submit" className="sr-only">
        Rechercher
      </button>
    </form>
  );
}
