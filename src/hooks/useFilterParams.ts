"use client";

import { useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string>, options?: { mode?: "push" | "replace" }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      startTransition(() => {
        const qs = params.toString();
        const url = qs ? `${pathname}?${qs}` : pathname;
        // Default "push" preserves existing behavior for every current caller.
        // Opt into "replace" for utility filters that should not stack history.
        if (options?.mode === "replace") {
          router.replace(url, { scroll: false });
        } else {
          router.push(url, { scroll: false });
        }
      });
    },
    [router, pathname, searchParams, startTransition]
  );

  return { searchParams, isPending, updateParams };
}
