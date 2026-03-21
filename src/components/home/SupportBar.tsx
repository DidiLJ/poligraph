import Link from "next/link";
import { Heart } from "lucide-react";

export function SupportBar() {
  return (
    <section className="rounded-xl border bg-card p-6 text-center">
      <p className="text-muted-foreground mb-4">
        Poligraph est un projet citoyen, ouvert et indépendant.
      </p>
      <Link
        href="/soutenir"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand text-brand-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        <Heart className="h-4 w-4" />
        Nous soutenir
      </Link>
    </section>
  );
}
