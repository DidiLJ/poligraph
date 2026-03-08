import Link from "next/link";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ensureContrast } from "@/lib/contrast";

interface DossierAuthor {
  politician: {
    slug: string;
    fullName: string;
    photoUrl: string | null;
    civility: string | null;
    currentParty: { shortName: string; color: string | null } | null;
  };
}

export function DossierAuthors({ authors }: { authors: DossierAuthor[] }) {
  if (!authors || authors.length === 0) return null;

  const label = authors.length === 1 ? "Auteur de la proposition" : "Auteurs de la proposition";

  return (
    <Card className="mb-8 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {label} ({authors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          {authors.map((a) => {
            const party = a.politician.currentParty;
            const partyColor = party?.color ? ensureContrast(party.color) : undefined;

            return (
              <Link
                key={a.politician.slug}
                href={`/politiques/${a.politician.slug}`}
                prefetch={false}
                className="flex items-center gap-3 group"
              >
                <PoliticianAvatar
                  photoUrl={a.politician.photoUrl}
                  fullName={a.politician.fullName}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium group-hover:underline leading-tight">
                    {a.politician.civility ? `${a.politician.civility} ` : ""}
                    {a.politician.fullName}
                  </p>
                  {party && (
                    <p
                      className="text-xs mt-0.5"
                      style={partyColor ? { color: partyColor } : undefined}
                    >
                      {party.shortName}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
