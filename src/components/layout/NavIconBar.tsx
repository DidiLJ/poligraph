"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { NavItem } from "@/config/navigation";

interface NavIconBarProps {
  tools: NavItem[];
}

export function NavIconBar({ tools: _tools }: NavIconBarProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Search */}
      <Link
        href="/recherche"
        className="flex items-center justify-center h-9 w-9 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Rechercher"
      >
        <Search className="h-[18px] w-[18px]" />
      </Link>

      {/* Theme toggle */}
      <ThemeToggle />
    </div>
  );
}
