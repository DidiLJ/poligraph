"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Shield, Users } from "lucide-react";

type AffairMode = "mise-en-cause" | "victime";

export function AffairModeToggle({ mode }: { mode: AffairMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setMode = useCallback(
    (newMode: AffairMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      params.set("mode", newMode);
      router.push(`/affaires?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex gap-2" role="group" aria-label="Type d affaires">
      <button
        onClick={() => setMode("mise-en-cause")}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          mode === "mise-en-cause"
            ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700"
            : "bg-muted text-muted-foreground hover:bg-accent"
        }`}
        aria-pressed={mode === "mise-en-cause"}
      >
        <Shield className="h-4 w-4" />
        Mis en cause
      </button>
      <button
        onClick={() => setMode("victime")}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          mode === "victime"
            ? "bg-blue-100 text-blue-900 ring-1 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-700"
            : "bg-muted text-muted-foreground hover:bg-accent"
        }`}
        aria-pressed={mode === "victime"}
      >
        <Users className="h-4 w-4" />
        Violences contre les elus
      </button>
    </div>
  );
}
