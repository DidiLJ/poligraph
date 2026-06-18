"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Shield, Users } from "lucide-react";

type AffairMode = "mise-en-cause" | "victime";

export function AffairModeToggle({ mode }: { mode: AffairMode }) {
  const searchParams = useSearchParams();

  // "mode=victime" is a real navigable variant: keep <Link> semantics (crawlable
  // href, middle-click, open-in-new-tab) but use `replace` so switching perimeter
  // does not stack browser history. The default perimeter resolves to a clean URL.
  const buildHref = (target: AffairMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (target === "victime") {
      params.set("mode", "victime");
    } else {
      params.delete("mode");
    }
    const qs = params.toString();
    return qs ? `/affaires?${qs}` : "/affaires";
  };

  return (
    <div className="flex gap-2" role="group" aria-label="Type d'affaires">
      <Link
        href={buildHref("mise-en-cause")}
        replace
        scroll={false}
        aria-current={mode === "mise-en-cause" ? "page" : undefined}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          mode === "mise-en-cause"
            ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700"
            : "bg-muted text-muted-foreground hover:bg-accent"
        }`}
      >
        <Shield className="h-4 w-4" />
        Mis en cause
      </Link>
      <Link
        href={buildHref("victime")}
        replace
        scroll={false}
        aria-current={mode === "victime" ? "page" : undefined}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          mode === "victime"
            ? "bg-blue-100 text-blue-900 ring-1 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-700"
            : "bg-muted text-muted-foreground hover:bg-accent"
        }`}
      >
        <Users className="h-4 w-4" />
        Violences contre les élus
      </Link>
    </div>
  );
}
