import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

const SITE_URL = "https://poligraph.fr";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = [{ label: "Accueil", href: "/" }, ...items];

  return (
    <>
      <BreadcrumbJsonLd
        items={allItems.map((item) => ({
          name: item.label,
          url: `${SITE_URL}${item.href || ""}`,
        }))}
      />
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground mb-6">
        <ol className="flex items-center gap-1 flex-wrap">
          {allItems.map((item, i) => {
            const isLast = i === allItems.length - 1;

            return (
              <li key={item.href || item.label} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span className="text-foreground font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href!} className="hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
