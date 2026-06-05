"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VoteTitleDisplay } from "@/components/votes/VoteTitleDisplay";
import {
  resolvePublicTitle,
  type ScrutinForDisplay,
  type PolicyTitleForDisplay,
} from "@/lib/votes/resolve-public-title";

interface PublicPreviewCardProps {
  scrutin: ScrutinForDisplay;
  /** The REAL row's status + current (possibly edited) title/subtitle. */
  policy: PolicyTitleForDisplay;
  /** ONLY this component may simulate approval for preview purposes. */
  previewAsApproved?: boolean;
}

export function PublicPreviewCard({
  scrutin,
  policy,
  previewAsApproved = false,
}: PublicPreviewCardProps) {
  // Synthetic approval is constructed INLINE and never leaves this component:
  // it is never persisted, never returned, and never passed to a server action.
  // resolvePublicTitle itself never fakes approval (that is its contract); this
  // override exists solely so a reviewer can preview the post-approval render.
  const effectivePolicy: PolicyTitleForDisplay = previewAsApproved
    ? { ...policy, status: "APPROVED" }
    : policy;

  const view = resolvePublicTitle(scrutin, effectivePolicy);

  const showPreviewLabel = previewAsApproved && policy.status !== "APPROVED";

  return (
    <div className="space-y-2">
      {showPreviewLabel ? <Badge variant="secondary">Aperçu — pas encore publié</Badge> : null}
      <Card>
        <CardContent className="pt-6">
          <VoteTitleDisplay view={view} variant="preview" />
        </CardContent>
      </Card>
    </div>
  );
}
