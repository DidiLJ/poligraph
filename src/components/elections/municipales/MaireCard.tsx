import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DEPARTMENTS } from "@/config/departments";
import { PoligraphBadge } from "@/components/elections/PoligraphBadge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";

interface MaireCardProps {
  maire: {
    id: string;
    fullName: string;
    gender: string | null;
    departmentCode: string;
    functionStart: Date | null;
    mandateStart: Date | null;
    party: { shortName: string; color: string | null; slug: string | null } | null;
    politician: { slug: string; fullName: string; photoUrl: string | null } | null;
    commune: { name: string; departmentCode: string; population: number | null } | null;
  };
}

export function MaireCard({ maire }: MaireCardProps) {
  const startYear = maire.functionStart?.getFullYear() ?? maire.mandateStart?.getFullYear();
  const deptName = DEPARTMENTS[maire.departmentCode]?.name;

  const content = (
    <Card
      className={`h-full transition-all ${maire.politician ? "hover:shadow-sm hover:border-primary/50 hover:-translate-y-0.5 cursor-pointer" : ""}`}
    >
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          {maire.politician?.photoUrl && (
            <PoliticianAvatar
              photoUrl={maire.politician.photoUrl}
              fullName={maire.fullName}
              size="sm"
              className="shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{maire.fullName}</p>

            {maire.commune && (
              <p className="text-sm text-muted-foreground mt-0.5">{maire.commune.name}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {deptName &&
                (maire.politician ? (
                  <Badge variant="outline" className="text-xs">
                    {deptName} ({maire.departmentCode})
                  </Badge>
                ) : (
                  <Link
                    href={`/elections/municipales-2026/departements/${maire.departmentCode}`}
                    prefetch={false}
                  >
                    <Badge variant="outline" className="text-xs hover:bg-muted transition-colors">
                      {deptName} ({maire.departmentCode})
                    </Badge>
                  </Link>
                ))}
              {maire.party && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: maire.party.color ? `${maire.party.color}20` : undefined,
                    color: maire.party.color || undefined,
                    borderColor: maire.party.color ? `${maire.party.color}40` : undefined,
                  }}
                >
                  {maire.party.shortName}
                </Badge>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              {startYear && <span>En poste depuis {startYear}</span>}
              {maire.politician && <PoligraphBadge />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (maire.politician) {
    return (
      <Link href={`/politiques/${maire.politician.slug}`} prefetch={false}>
        {content}
      </Link>
    );
  }

  return content;
}
