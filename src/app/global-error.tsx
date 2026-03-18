"use client";

import { useEffect } from "react";
import { SectionErrorPage } from "@/components/ui/SectionErrorPage";
import { atkinson, outfit } from "./fonts";
import "./globals.css";

export default function GlobalError({
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
    <html lang="fr">
      <body
        className={`${outfit.variable} ${atkinson.variable} antialiased min-h-screen flex flex-col overflow-x-hidden`}
      >
        <SectionErrorPage
          title="Le site est momentanément indisponible"
          description="Réessayez dans un instant ou revenez à l'accueil."
          backHref="/"
          backLabel="Retour à l'accueil"
          onReset={reset}
        />
      </body>
    </html>
  );
}
