"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TITLE_NEUTRAL_MAX = 90;
const TITLE_AMBER_MAX = 140;
const SUBTITLE_NEUTRAL_MAX = 200;
const SUBTITLE_AMBER_MAX = 180;

interface PolicyTitleEditorProps {
  scrutinId: string;
  initialTitle: string | null;
  initialSubtitle: string | null;
  onChange?: (title: string | null, subtitle: string | null) => void;
  onSave?: (title: string | null, subtitle: string | null) => void;
}

/** Title count color: neutral <=90, amber 91-140, red >140. */
function titleCountClass(length: number): string {
  if (length > TITLE_AMBER_MAX) return "text-red-600";
  if (length > TITLE_NEUTRAL_MAX) return "text-amber-600";
  return "text-muted-foreground";
}

/** Subtitle count color: neutral <=180, amber >180. */
function subtitleCountClass(length: number): string {
  if (length > SUBTITLE_AMBER_MAX) return "text-amber-600";
  return "text-muted-foreground";
}

export function PolicyTitleEditor({
  scrutinId,
  initialTitle,
  initialSubtitle,
  onChange,
  onSave,
}: PolicyTitleEditorProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");

  const editedFromGenerated =
    title !== (initialTitle ?? "") || subtitle !== (initialSubtitle ?? "");

  const titleLength = title.length;
  const subtitleLength = subtitle.length;
  const titleTooLong = titleLength > TITLE_AMBER_MAX;

  const toNullable = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? value : null;
  };

  function applyTitle(value: string) {
    setTitle(value);
    onChange?.(toNullable(value), toNullable(subtitle));
  }

  function applySubtitle(value: string) {
    setSubtitle(value);
    onChange?.(toNullable(title), toNullable(value));
  }

  function reset() {
    setTitle(initialTitle ?? "");
    setSubtitle(initialSubtitle ?? "");
    onChange?.(toNullable(initialTitle ?? ""), toNullable(initialSubtitle ?? ""));
  }

  function handleSave() {
    if (titleTooLong) return;
    if (onSave) {
      onSave(toNullable(title), toNullable(subtitle));
      return;
    }
    // TODO(5.6): wire to the save/approve server action.
  }

  return (
    <div className="space-y-4" data-scrutin-id={scrutinId}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="policy-title-input">Titre public</Label>
          <span className={cn("text-xs tabular-nums", titleCountClass(titleLength))}>
            {titleLength} / {TITLE_NEUTRAL_MAX}
          </span>
        </div>
        <Input
          id="policy-title-input"
          value={title}
          onChange={(e) => applyTitle(e.target.value)}
          aria-invalid={titleTooLong}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="policy-subtitle-input">Sous-titre</Label>
          <span className={cn("text-xs tabular-nums", subtitleCountClass(subtitleLength))}>
            {subtitleLength} / {SUBTITLE_NEUTRAL_MAX}
          </span>
        </div>
        <Textarea
          id="policy-subtitle-input"
          value={subtitle}
          onChange={(e) => applySubtitle(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        {editedFromGenerated ? (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Réinitialiser au généré
          </button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={handleSave} disabled={titleTooLong}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
