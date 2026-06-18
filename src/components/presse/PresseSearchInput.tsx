"use client";

import { UrlSearchInput } from "@/components/filters";

export function PresseSearchInput({ value }: { value: string }) {
  return (
    <UrlSearchInput
      value={value}
      placeholder="Rechercher un article..."
      className="flex-1 min-w-[200px]"
    />
  );
}
