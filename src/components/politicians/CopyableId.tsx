"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyableIdProps {
  value: string;
}

export function CopyableId({ value }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied in insecure contexts
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copier l'identifiant"
    >
      <span className="font-mono">{value}</span>
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}
