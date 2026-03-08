import Link from "next/link";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { Users } from "lucide-react";

interface DossierAuthor {
  politician: {
    slug: string;
    fullName: string;
    photoUrl: string | null;
  };
}

export function DossierAuthors({ authors }: { authors: DossierAuthor[] }) {
  if (!authors || authors.length === 0) return null;

  return (
    <div className="flex items-start gap-3 mb-6">
      <Users className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
      <div className="flex flex-wrap gap-3">
        {authors.map((a) => (
          <Link
            key={a.politician.slug}
            href={`/politiques/${a.politician.slug}`}
            className="inline-flex items-center gap-2 text-sm hover:underline"
            prefetch={false}
          >
            <PoliticianAvatar
              photoUrl={a.politician.photoUrl}
              fullName={a.politician.fullName}
              size="sm"
            />
            <span>{a.politician.fullName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
