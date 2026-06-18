"use client";

import { UrlSearchInput } from "@/components/filters";

export function VotesSearchInput({ value }: { value: string }) {
  return (
    <UrlSearchInput
      value={value}
      placeholder="Rechercher un scrutin..."
      className="flex-1 min-w-[200px]"
    />
  );
}
