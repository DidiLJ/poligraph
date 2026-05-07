"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackUmami } from "@/lib/umami";

export default function BienvenuePage() {
  useEffect(() => {
    trackUmami("newsletter_confirmation_clicked");
  }, []);

  return (
    <main className="container max-w-2xl py-16 text-center">
      <h1 className="text-3xl font-display font-extrabold tracking-tight mb-4">
        Inscription confirmée !
      </h1>
      <p className="mb-8 text-muted-foreground">
        Tu recevras le Recap dimanche prochain. En attendant, lis le dernier numéro :
      </p>
      <Link
        href="/recap"
        className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Lire le dernier Recap
      </Link>
    </main>
  );
}
