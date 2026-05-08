"use client";

import { useState } from "react";
import { Twitter, Linkedin, Link as LinkIcon, Check } from "lucide-react";

interface Props {
  shareUrl: string;
  totalVotes: number;
  totalAffairs: number;
  totalArticles: number;
  weekIso: string;
}

export function RecapShareBlock({ shareUrl, totalVotes, totalAffairs, totalArticles }: Props) {
  const [copied, setCopied] = useState(false);

  const tweetText = `Cette semaine au Parlement français : ${totalVotes} scrutins, ${totalAffairs} affaires, ${totalArticles} articles. Le récap :`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can throw in insecure contexts; silently ignore.
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur X (Twitter)"
        className="inline-flex h-11 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-accent"
      >
        <Twitter className="h-4 w-4" aria-hidden="true" />
        Partager sur X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur LinkedIn"
        className="inline-flex h-11 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-accent"
      >
        <Linkedin className="h-4 w-4" aria-hidden="true" />
        LinkedIn
      </a>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copier le lien du Recap"
        className="inline-flex h-11 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-accent"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Copié !
          </>
        ) : (
          <>
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
            Copier le lien
          </>
        )}
      </button>
    </div>
  );
}
