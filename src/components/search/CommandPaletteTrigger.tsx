"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "./CommandPaletteProvider";

export function CommandPaletteTrigger() {
  const { open } = useCommandPalette();
  const isMac = typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");

  return (
    <button
      type="button"
      onClick={open}
      className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors min-w-[200px]"
      aria-label="Rechercher (Cmd+K)"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Rechercher...</span>
      <kbd className="inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        {isMac ? "⌘" : "Ctrl+"}K
      </kbd>
    </button>
  );
}

export function CommandPaletteTriggerMobile() {
  const { open } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={open}
      className="flex lg:hidden items-center justify-center h-9 w-9 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
      aria-label="Rechercher"
    >
      <Search className="h-[18px] w-[18px]" />
    </button>
  );
}
