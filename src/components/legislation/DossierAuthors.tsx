import Link from "next/link";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { Users, BookOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ensureContrast } from "@/lib/contrast";
import type { DossierActorRole, Chamber } from "@/generated/prisma";

interface DossierAuthor {
  role?: DossierActorRole | null;
  chamber?: Chamber | null;
  commission?: string | null;
  politician: {
    slug: string;
    fullName: string;
    photoUrl: string | null;
    civility: string | null;
    currentParty: { shortName: string; color: string | null } | null;
  };
}

const CHAMBER_LABELS: Record<string, string> = {
  AN: "AN",
  SENAT: "Sénat",
};

function AuthorEntry({
  author,
  showCommission,
}: {
  author: DossierAuthor;
  showCommission?: boolean;
}) {
  const party = author.politician.currentParty;
  const partyColor = party?.color ? ensureContrast(party.color) : undefined;
  const chamberLabel = author.chamber ? CHAMBER_LABELS[author.chamber] : null;

  return (
    <Link
      key={`${author.politician.slug}-${author.role ?? "auteur"}`}
      href={`/politiques/${author.politician.slug}`}
      prefetch={false}
      className="flex items-center gap-3 group"
    >
      <PoliticianAvatar
        photoUrl={author.politician.photoUrl}
        fullName={author.politician.fullName}
        size="md"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium group-hover:underline leading-tight">
          {author.politician.civility ? `${author.politician.civility} ` : ""}
          {author.politician.fullName}
        </p>
        {(party || chamberLabel) && (
          <p className="text-xs mt-0.5 flex items-center gap-1.5">
            {party && (
              <span style={partyColor ? { color: partyColor } : undefined}>{party.shortName}</span>
            )}
            {chamberLabel && <span className="text-muted-foreground">{chamberLabel}</span>}
          </p>
        )}
        {showCommission && author.commission && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{author.commission}</p>
        )}
      </div>
    </Link>
  );
}

export function DossierAuthors({ authors }: { authors: DossierAuthor[] }) {
  if (!authors || authors.length === 0) return null;

  const auteurs = authors.filter(
    (a) => !a.role || a.role === "AUTEUR" || a.role === "COSIGNATAIRE"
  );
  const rapporteurs = authors.filter(
    (a) => a.role === "RAPPORTEUR" || a.role === "RAPPORTEUR_AVIS"
  );

  const hasRapporteurs = rapporteurs.length > 0;

  if (!hasRapporteurs) {
    const label = auteurs.length === 1 ? "Auteur de la proposition" : "Auteurs de la proposition";

    return (
      <Card className="mb-8 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            {label} ({auteurs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {auteurs.map((a) => (
              <AuthorEntry key={`${a.politician.slug}-${a.role ?? "auteur"}`} author={a} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Acteurs du dossier ({authors.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {auteurs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Auteurs ({auteurs.length})
            </h4>
            <div className="flex flex-wrap gap-6">
              {auteurs.map((a) => (
                <AuthorEntry key={`${a.politician.slug}-${a.role ?? "auteur"}`} author={a} />
              ))}
            </div>
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" />
            Rapporteurs ({rapporteurs.length})
          </h4>
          <div className="flex flex-wrap gap-6">
            {rapporteurs.map((a) => (
              <AuthorEntry
                key={`${a.politician.slug}-${a.role ?? "rapporteur"}`}
                author={a}
                showCommission
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
