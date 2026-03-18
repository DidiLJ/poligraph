"use client";

import { useEffect } from "react";
import { SectionErrorPage } from "@/components/ui/SectionErrorPage";

export default function Error({
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
      title="Oups, la section Assemblée nationale est indisponible"
      description="Réessayez dans un instant ou revenez à la page de l'Assemblée nationale."
      backHref="/assemblee"
      backLabel="Retour à l'Assemblée"
      onReset={reset}
    />
  );
}
