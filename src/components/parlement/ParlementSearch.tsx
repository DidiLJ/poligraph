"use client";

import { DebouncedSearchInput } from "@/components/filters";
import { useRouter } from "next/navigation";

export function ParlementSearch() {
  const router = useRouter();

  return (
    <DebouncedSearchInput
      value=""
      onSearch={(v) => {
        if (v.trim()) {
          router.push(`/parlement?search=${encodeURIComponent(v.trim())}`);
        }
      }}
      placeholder="Rechercher un scrutin, un sujet, un thème..."
      className="w-full max-w-xl"
    />
  );
}
