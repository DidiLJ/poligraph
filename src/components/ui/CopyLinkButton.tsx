"use client";

import { useState, useRef, useEffect } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyLinkButtonProps {
  url?: string;
  className?: string;
  /** For Storybook/dev: initial copied state to show visual feedback without clicking. */
  initialCopied?: boolean;
}

export function CopyLinkButton({ url, className, initialCopied }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(initialCopied ?? false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      const trimmedUrl = url?.trim();
      const textToCopy =
        trimmedUrl && trimmedUrl.length > 0
          ? trimmedUrl
          : typeof window !== "undefined"
            ? window.location.href
            : "";
      if (!textToCopy) return;
      await navigator.clipboard.writeText(textToCopy);
      if (!isMountedRef.current) return;
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopied(false);
        }
        timeoutRef.current = null;
      }, 2000);
    } catch {
      // Clipboard access can be denied in insecure contexts
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      aria-label={copied ? "Lien copié" : "Copier le lien"}
      className={cn(className)}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
    </Button>
  );
}
