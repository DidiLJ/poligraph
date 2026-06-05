"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PolicyTitleEditor } from "./PolicyTitleEditor";
import { PublicPreviewCard } from "./PublicPreviewCard";
import { Button } from "@/components/ui/button";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import {
  editScrutinPolicyTitle,
  approveScrutinPolicyTitle,
  approveWithOverrideScrutinPolicyTitle,
  rejectScrutinPolicyTitle,
  regenerateScrutinPolicyTitle,
} from "../actions";
import type { ScrutinForDisplay, PolicyTitleForDisplay } from "@/lib/votes/resolve-public-title";

interface EditAndPreviewProps {
  scrutinId: string;
  scrutin: ScrutinForDisplay;
  status: PolicyTitleForDisplay["status"];
  initialTitle: string | null;
  initialSubtitle: string | null;
}

/** Surfaces a thrown ApproveBlockedError's codes (or a generic message) as a toast. */
function reportError(err: unknown, fallback: string): void {
  const codes = (err as { codes?: string[] })?.codes;
  if (Array.isArray(codes) && codes.length > 0) {
    toast.error(`Approbation bloquée : ${codes.join(", ")}`);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

/**
 * Client wrapper holding the live edit state so the editor feeds the preview
 * directly, and wiring the save/approve/reject/regenerate server actions. The
 * two reason-gated paths (approve-with-override, reject) go through a prompt
 * dialog. Blocker codes from ApproveBlockedError are surfaced via toast.
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
  const [pending, startTransition] = useTransition();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  function handleSave(t: string | null, s: string | null) {
    startTransition(async () => {
      try {
        await editScrutinPolicyTitle(scrutinId, { policyTitle: t, policySubtitle: s });
        toast.success("Titre enregistré");
      } catch (err) {
        reportError(err, "Erreur lors de l'enregistrement");
      }
    });
  }

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveScrutinPolicyTitle(scrutinId);
        toast.success("Titre approuvé");
      } catch (err) {
        reportError(err, "Erreur lors de l'approbation");
      }
    });
  }

  function handleApproveWithReason(reason: string) {
    setOverrideOpen(false);
    startTransition(async () => {
      try {
        await approveWithOverrideScrutinPolicyTitle(scrutinId, reason);
        toast.success("Titre approuvé (avec motif)");
      } catch (err) {
        reportError(err, "Erreur lors de l'approbation");
      }
    });
  }

  function handleReject(reason: string) {
    setRejectOpen(false);
    startTransition(async () => {
      try {
        await rejectScrutinPolicyTitle(scrutinId, reason);
        toast.success("Titre rejeté");
      } catch (err) {
        reportError(err, "Erreur lors du rejet");
      }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      try {
        await regenerateScrutinPolicyTitle(scrutinId);
        toast.success("Régénération lancée");
      } catch (err) {
        reportError(err, "Erreur lors de la régénération");
      }
    });
  }

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
        onSave={handleSave}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleApprove} disabled={pending}>
          Approuver
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOverrideOpen(true)}
          disabled={pending}
        >
          Approuver avec motif
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setRejectOpen(true)}
          disabled={pending}
        >
          Rejeter
        </Button>
        <Button type="button" variant="ghost" onClick={handleRegenerate} disabled={pending}>
          Régénérer
        </Button>
      </div>

      <PublicPreviewCard
        scrutin={scrutin}
        policy={{ status, policyTitle: title, policySubtitle: subtitle }}
        previewAsApproved
      />

      <PromptDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        onSubmit={handleApproveWithReason}
        title="Approuver malgré les avertissements"
        description="Indiquez le motif justifiant l'approbation forcée. Les blocages durs ne peuvent pas être contournés."
        placeholder="Motif de l'approbation forcée"
        submitLabel="Approuver"
      />
      <PromptDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onSubmit={handleReject}
        title="Rejeter le titre"
        description="Indiquez le motif du rejet (obligatoire pour un titre de confiance élevée)."
        placeholder="Motif du rejet"
        submitLabel="Rejeter"
        variant="destructive"
      />
    </div>
  );
}
