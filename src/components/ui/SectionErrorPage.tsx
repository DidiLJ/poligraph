"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { HexPattern } from "@/components/ui/HexPattern";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SectionErrorPageProps {
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
  variant?: "public" | "admin";
  errorDigest?: string;
  onReset: () => void;
}

const DEFAULT_DESCRIPTION =
  "Quelque chose s'est mal passé. Vous pouvez réessayer ou revenir à la section précédente.";

export function SectionErrorPage({
  title,
  description = DEFAULT_DESCRIPTION,
  backHref,
  backLabel,
  variant = "public",
  errorDigest,
  onReset,
}: SectionErrorPageProps) {
  return (
    <div
      className={cn(
        "flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center",
        variant === "public"
          ? "relative bg-gradient-to-br from-primary/5 via-background to-accent/10"
          : "bg-background"
      )}
    >
      {variant === "public" ? (
        <HexPattern className="pointer-events-none absolute inset-0 text-primary opacity-[0.03] dark:opacity-[0.05]" />
      ) : null}
      <div className="relative z-10 flex max-w-4xl flex-col items-center">
        <div className="mb-6 flex h-20 items-center justify-center">
          {variant === "public" ? (
            <Image src="/logo.svg" alt="Poligraph" width={80} height={80} />
          ) : null}
        </div>
        <h1 className="mb-4 text-balance font-display text-4xl font-bold">{title}</h1>
        <p className="mb-3 max-w-2xl text-balance text-muted-foreground">{description}</p>
        {variant === "admin" && errorDigest ? (
          <p className="mb-8 text-xs text-muted-foreground">
            Code : <code className="font-mono">{errorDigest}</code>
          </p>
        ) : (
          <div className="mb-8 h-[18px]" aria-hidden="true" />
        )}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button type="button" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Réessayer
          </Button>
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
