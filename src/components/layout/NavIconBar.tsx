"use client";

import { CommandPaletteTrigger, CommandPaletteTriggerMobile } from "@/components/search";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { NavItem } from "@/config/navigation";

interface NavIconBarProps {
  tools: NavItem[];
}

export function NavIconBar({ tools: _tools }: NavIconBarProps) {
  return (
    <div className="flex items-center gap-1">
      <CommandPaletteTrigger />
      <CommandPaletteTriggerMobile />
      <ThemeToggle />
    </div>
  );
}
