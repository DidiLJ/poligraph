"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SectionErrorPage } from "@/components/ui/SectionErrorPage";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const isAdminPath = pathname.startsWith("/admin");

  useEffect(() => {
    // eslint-disable-next-line no-console -- Next.js error boundaries should log the captured error.
    console.error(error);
  }, [error]);

  return (
    <SectionErrorPage
      title={
        isAdminPath
          ? "Cette page d'administration est momentanément indisponible"
          : "Une erreur est survenue"
      }
      description={
        isAdminPath
          ? error.digest
            ? "Réessayez ou revenez au tableau de bord. Si le problème persiste, utilisez le code ci-dessous pour le diagnostic."
            : "Réessayez ou revenez au tableau de bord."
          : "Quelque chose s'est mal passé. Vous pouvez réessayer ou revenir à l'accueil."
      }
      backHref={isAdminPath ? "/admin" : "/"}
      backLabel={isAdminPath ? "Retour au tableau de bord" : "Retour à l'accueil"}
      variant={isAdminPath ? "admin" : "public"}
      errorDigest={isAdminPath ? error.digest : undefined}
      onReset={reset}
    />
  );
}
