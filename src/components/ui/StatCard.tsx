import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface StatCardProps {
  count: number;
  label: string;
  description?: string;
  accent: { border: string; bg: string };
  href?: string;
  isActive?: boolean;
}

export function StatCard({ count, label, description, accent, href, isActive }: StatCardProps) {
  const card = (
    <Card
      className={`relative border-l-4 transition-all ${
        href ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${isActive ? "ring-2 ring-primary shadow-md" : ""}`}
      style={{
        borderLeftColor: accent.border,
        backgroundColor: isActive ? accent.bg : undefined,
      }}
    >
      <CardContent className="p-3 py-3">
        {href && (
          <ArrowRight
            className="absolute top-3 right-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <div
          className="text-2xl md:text-3xl font-display font-extrabold tracking-tight"
          style={{ color: accent.border }}
        >
          {count.toLocaleString("fr-FR")}
        </div>
        <div className="text-sm font-medium mt-1 leading-tight">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1 leading-snug">{description}</div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false}>
        {card}
      </Link>
    );
  }

  return card;
}
