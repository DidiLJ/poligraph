import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3,
  ArrowLeftRight,
  MapPin,
  Map,
  Building,
  Newspaper,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickAccessItem {
  href: string;
  label: string;
  icon: LucideIcon;
  featureFlag?: string;
}

const ITEMS: QuickAccessItem[] = [
  { href: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/comparer", label: "Comparer", icon: ArrowLeftRight, featureFlag: "COMPARISON_TOOL" },
  { href: "/mon-depute", label: "Mon député", icon: MapPin },
  { href: "/carte", label: "Carte", icon: Map },
  { href: "/partis", label: "Partis", icon: Building },
  { href: "/presse", label: "Presse", icon: Newspaper, featureFlag: "PRESS_SECTION" },
];

interface QuickAccessProps {
  enabledFlags: Set<string>;
}

export function QuickAccess({ enabledFlags }: QuickAccessProps) {
  const filtered = ITEMS.filter((item) => !item.featureFlag || enabledFlags.has(item.featureFlag));

  return (
    <section>
      <h2 className="text-lg font-display font-bold mb-4">Accès rapide</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} prefetch={false}>
              <Card className="group cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all h-full">
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
