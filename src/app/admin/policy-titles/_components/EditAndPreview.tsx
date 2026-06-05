"use client";

import { useState } from "react";
import { PolicyTitleEditor } from "./PolicyTitleEditor";
import { PublicPreviewCard } from "./PublicPreviewCard";
import type { ScrutinForDisplay, PolicyTitleForDisplay } from "@/lib/votes/resolve-public-title";

interface EditAndPreviewProps {
  scrutinId: string;
  scrutin: ScrutinForDisplay;
  status: PolicyTitleForDisplay["status"];
  initialTitle: string | null;
  initialSubtitle: string | null;
}

/**
 * Client wrapper holding the live edit state so the editor feeds the preview
 * directly. Save/approve server actions are TODO(5.6); this only manages local
 * state and renders the post-approval preview.
 */
export function EditAndPreview({
  scrutinId,
  scrutin,
  status,
  initialTitle,
  initialSubtitle,
}: EditAndPreviewProps) {
  const [title, setTitle] = useState<string | null>(initialTitle);
  const [subtitle, setSubtitle] = useState<string | null>(initialSubtitle);

  return (
    <div className="space-y-4">
      <PolicyTitleEditor
        scrutinId={scrutinId}
        initialTitle={initialTitle}
        initialSubtitle={initialSubtitle}
        onChange={(t, s) => {
          setTitle(t);
          setSubtitle(s);
        }}
      />
      <PublicPreviewCard
        scrutin={scrutin}
        policy={{ status, policyTitle: title, policySubtitle: subtitle }}
        previewAsApproved
      />
    </div>
  );
}
