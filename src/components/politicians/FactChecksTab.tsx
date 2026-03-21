// src/components/politicians/FactChecksTab.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { FACTCHECK_RATING_LABELS, FACTCHECK_RATING_COLORS } from "@/config/labels";
import type { FactCheckRating } from "@/types";

interface FactCheckMention {
  id: string;
  isClaimant: boolean;
  factCheck: {
    id: string;
    slug: string | null;
    title: string;
    claimText: string;
    claimant: string | null;
    verdictRating: FactCheckRating;
    source: string;
    sourceUrl: string;
    publishedAt: Date;
  };
}

interface FactChecksTabProps {
  mentions: FactCheckMention[];
  politicianSlug: string;
}

function computeVerdictCounts(claims: FactCheckMention[]) {
  return claims.reduce(
    (acc, m) => {
      const r = m.factCheck.verdictRating;
      if (r === "TRUE" || r === "MOSTLY_TRUE") acc.vrai++;
      else if (r === "FALSE" || r === "MOSTLY_FALSE") acc.faux++;
      else if (r === "UNVERIFIABLE") acc.autre++;
      else acc.mitige++;
      return acc;
    },
    { vrai: 0, faux: 0, mitige: 0, autre: 0 }
  );
}

function VerdictBar({
  counts,
  total,
}: {
  counts: ReturnType<typeof computeVerdictCounts>;
  total: number;
}) {
  if (total === 0) return null;

  const segments = [
    {
      key: "faux",
      count: counts.faux,
      color: "bg-red-400",
      textColor: "text-red-600",
      label: "Faux",
    },
    {
      key: "mitige",
      count: counts.mitige,
      color: "bg-yellow-400",
      textColor: "text-yellow-600",
      label: "Mitige",
    },
    {
      key: "vrai",
      count: counts.vrai,
      color: "bg-green-400",
      textColor: "text-green-600",
      label: "Vrai",
    },
    {
      key: "autre",
      count: counts.autre,
      color: "bg-gray-300",
      textColor: "text-gray-500",
      label: "Autre",
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex h-3 rounded-full overflow-hidden">
        {segments.map(
          (s) =>
            s.count > 0 && (
              <div
                key={s.key}
                className={s.color}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label} : ${s.count}`}
              />
            )
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        {segments.map(
          (s) =>
            s.count > 0 && (
              <span key={s.key} className={s.textColor}>
                {s.label} : {s.count}
              </span>
            )
        )}
      </div>
    </div>
  );
}

function MentionRow({ mention }: { mention: FactCheckMention }) {
  return (
    <div className="border-b last:border-0 pb-3 last:pb-0 space-y-1">
      <div className="flex items-center gap-2">
        <Badge className={`shrink-0 ${FACTCHECK_RATING_COLORS[mention.factCheck.verdictRating]}`}>
          {FACTCHECK_RATING_LABELS[mention.factCheck.verdictRating]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {mention.factCheck.source} · {formatDate(mention.factCheck.publishedAt)}
        </span>
      </div>
      {mention.factCheck.slug ? (
        <Link
          href={`/factchecks/${mention.factCheck.slug}`}
          className="text-sm font-medium hover:underline block"
        >
          {mention.factCheck.title}
        </Link>
      ) : (
        <a
          href={mention.factCheck.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline block"
        >
          {mention.factCheck.title}
        </a>
      )}
      {mention.factCheck.claimText && (
        <p className="text-sm text-muted-foreground">
          {mention.factCheck.claimant && (
            <span className="font-medium">{mention.factCheck.claimant} : </span>
          )}
          &laquo;&nbsp;{mention.factCheck.claimText}&nbsp;&raquo;
        </p>
      )}
    </div>
  );
}

export function FactChecksTab({ mentions, politicianSlug }: FactChecksTabProps) {
  const directClaims = mentions.filter((m) => m.isClaimant);
  const otherMentions = mentions.filter((m) => !m.isClaimant);
  const verdictCounts = computeVerdictCounts(directClaims);
  const verdictTotal =
    verdictCounts.vrai + verdictCounts.mitige + verdictCounts.faux + verdictCounts.autre;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="leading-none font-semibold">Fact-checks</h2>
            <Link
              href={`/factchecks?politician=${politicianSlug}`}
              className="text-sm text-primary hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Verdicts {"é"}mis par les organismes de fact-checking cit{"é"}s.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Verdict distribution bar */}
          {directClaims.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">
                Ses d{"é"}clarations v{"é"}rifi{"é"}es ({directClaims.length})
              </h3>
              <VerdictBar counts={verdictCounts} total={verdictTotal} />
              <div className="space-y-3">
                {directClaims.map((mention) => (
                  <MentionRow key={mention.id} mention={mention} />
                ))}
              </div>
            </div>
          )}

          {/* Other mentions */}
          {otherMentions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                Mentionn{"é"} dans ({otherMentions.length})
              </h3>
              <div className="space-y-3">
                {otherMentions.map((mention) => (
                  <MentionRow key={mention.id} mention={mention} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
