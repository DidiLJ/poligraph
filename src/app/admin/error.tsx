"use client";

import { useEffect } from "react";
import { SectionErrorPage } from "@/components/ui/SectionErrorPage";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- Next.js error boundaries should log the captured error.
    console.error(error);
  }, [error]);

  return (
    <SectionErrorPage
      title="Cette page d'administration est momentanément indisponible"
      description="Réessayez ou revenez au tableau de bord. Si le problème persiste, utilisez le code ci-dessous pour le diagnostic."
      backHref="/admin"
      backLabel="Retour au tableau de bord"
      variant="admin"
      errorDigest={error.digest}
      onReset={reset}
    />
  );
}
