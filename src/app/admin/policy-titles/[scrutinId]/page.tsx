import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { loadReview } from "../_data/review-query";
import { ReviewHealthBanner } from "../_components/ReviewHealthBanner";
import { ScrutinOfficialPane } from "../_components/ScrutinOfficialPane";
import { EvidencePane } from "../_components/EvidencePane";
import { TitleTokenAnchors } from "../_components/TitleTokenAnchors";
import { WarningsPanel } from "../_components/WarningsPanel";
import { QualitySignalsCard } from "../_components/QualitySignalsCard";
import { RevisionHistory } from "../_components/RevisionHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  EvidenceQuote,
  GenerationWarning,
  QualitySignals,
} from "@/services/scrutin-policy-title/types";

interface PageProps {
  params: Promise<{ scrutinId: string }>;
}

export default async function PolicyTitleReviewPage({ params }: PageProps) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  const { scrutinId } = await params;
  const review = await loadReview(scrutinId);
  if (!review) {
    notFound();
  }

  const { scrutin, policy, amendmentLinks, blocks, currentWarnings, revisions } = review;

  const qualitySignals = policy.qualitySignals as unknown as QualitySignals;
  const evidenceQuotes = (policy.evidenceQuotes ?? []) as unknown as EvidenceQuote[];
  const generationWarnings = (policy.generationWarnings ?? []) as unknown as GenerationWarning[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/policy-titles" className="text-sm text-muted-foreground hover:underline">
          ← Retour à la file
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          {policy.policyTitle ?? "Titre à saisir"}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{scrutin.externalId}</p>
      </div>

      <ReviewHealthBanner
        confidence={policy.confidence}
        qualitySignals={qualitySignals}
        currentWarnings={currentWarnings}
      />

      {policy.policyTitle ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Titre public proposé</CardTitle>
          </CardHeader>
          <CardContent>
            <TitleTokenAnchors title={policy.policyTitle} evidenceQuotes={evidenceQuotes} />
            {policy.policySubtitle ? (
              <p className="mt-2 text-sm text-muted-foreground">{policy.policySubtitle}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Three-pane layout on lg+, vertical stack below. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <ScrutinOfficialPane scrutin={scrutin} amendmentLinks={amendmentLinks} />
        </div>

        <div className="space-y-6">
          <EvidencePane evidenceQuotes={evidenceQuotes} blocks={blocks} />
        </div>

        <div className="space-y-6">
          {/* TODO(Plan 5.5): PolicyTitleEditor mounts here (edit form + actions). */}
          <WarningsPanel
            generationWarnings={generationWarnings}
            currentWarnings={currentWarnings}
          />
          <QualitySignalsCard signals={qualitySignals} />
        </div>
      </div>

      <RevisionHistory revisions={revisions} />
    </div>
  );
}
