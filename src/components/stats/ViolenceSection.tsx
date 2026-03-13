import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";

interface ViolenceStats {
  totalAffairs: number;
  totalPoliticians: number;
  ongoingProcedures: number;
}

const BLUE_ACCENT = { border: "#2563eb", bg: "#dbeafe" };

export function ViolenceSection({ stats }: { stats: ViolenceStats }) {
  if (stats.totalAffairs === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Violences contre les élus</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          count={stats.totalPoliticians}
          label="Élus concernés"
          accent={BLUE_ACCENT}
          href="/affaires?mode=victime"
        />
        <StatCard count={stats.totalAffairs} label="Affaires documentées" accent={BLUE_ACCENT} />
        <StatCard
          count={stats.ongoingProcedures}
          label="Procédures en cours"
          accent={BLUE_ACCENT}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Critères d{"'"}inclusion : source journalistique vérifiable, affaire documentée.{" "}
        <Link href="/sources" className="text-primary hover:underline">
          En savoir plus
        </Link>
      </p>
    </div>
  );
}
