import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface IncumbentMaireCardProps {
  maire: {
    fullName: string;
    slug: string;
    gender: string | null;
    mandateStart: Date | null;
    firstElectedDate: Date | null;
    partyLabel: string | null;
    party: { shortName: string; color: string | null } | null;
    photoUrl: string | null;
  };
  isRunningAgain: boolean;
  /** Result status when T1 results are available */
  resultStatus?: "reelected" | "runoff" | "defeated" | null;
}

export function IncumbentMaireCard({
  maire,
  isRunningAgain,
  resultStatus,
}: IncumbentMaireCardProps) {
  const startYear = maire.firstElectedDate?.getFullYear() ?? maire.mandateStart?.getFullYear();
  const partyName = maire.party?.shortName ?? maire.partyLabel;

  return (
    <div className="border rounded-xl p-4 bg-card">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        Maire sortant{maire.gender === "F" ? "e" : ""}
      </p>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-lg">
            <Link href={`/politiques/${maire.slug}`} prefetch={false} className="hover:underline">
              {maire.fullName}
            </Link>
            {partyName && <span className="text-muted-foreground font-normal"> ({partyName})</span>}
          </p>
          {startYear && (
            <p className="text-sm text-muted-foreground">En poste depuis {startYear}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {resultStatus === "reelected" ? (
            <Badge variant="default" className="bg-emerald-600">
              Réélu{maire.gender === "F" ? "e" : ""}
            </Badge>
          ) : resultStatus === "defeated" ? (
            <Badge variant="destructive">Battu{maire.gender === "F" ? "e" : ""}</Badge>
          ) : resultStatus === "runoff" ? (
            <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
              2nd tour
            </Badge>
          ) : isRunningAgain ? (
            <Badge variant="default" className="bg-emerald-600">
              Se représente
            </Badge>
          ) : (
            <Badge variant="secondary">Ne se représente pas</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
