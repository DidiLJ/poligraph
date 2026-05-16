import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DONATION_PLATFORMS,
  EXPENSES,
  FEATURES_FUNDED,
  RESCRIT_STATUS,
  totalMonthlyEuros,
} from "@/config/donation";

export const metadata: Metadata = {
  title: "Soutenez Poligraph",
  description:
    "Aidez l'association Sankofa à maintenir et développer cette plateforme citoyenne d'information politique.",
  alternates: { canonical: "/soutenir" },
};

function rescritMessage(): string {
  switch (RESCRIT_STATUS) {
    case "validated":
      return "Reçu fiscal automatique : votre don est déductible à 66% de votre impôt sur le revenu (60% pour les entreprises).";
    case "in_review":
      return "Reçu fiscal à venir une fois le rescrit fiscal de l'association validé. Le rescrit est en cours d'instruction.";
    case "pending":
      return "L'association n'est pas encore éligible au reçu fiscal. La démarche est en préparation.";
  }
}

export default function SoutenirPage() {
  const primary = DONATION_PLATFORMS.find((p) => p.primary)!;
  const secondary = DONATION_PLATFORMS.filter((p) => !p.primary);
  const totalMonthly = totalMonthlyEuros();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-4">
          Soutenez Poligraph
        </h1>
        <p className="text-lg text-muted-foreground">
          Un projet citoyen indépendant porté par l&apos;association Sankofa, qui a besoin de votre
          soutien pour continuer à informer sur la vie politique française.
        </p>
      </div>

      {/* CTA Principal HelloAsso */}
      <Card className="mb-12 border-primary/30 bg-primary/5">
        <CardContent className="pt-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Faites un don à Sankofa</h2>
          <p className="text-muted-foreground mb-6">
            Chaque contribution, même modeste, nous aide à maintenir ce service gratuit et sans
            publicité. 0% de commission, vos dons vont directement à l&apos;association.
          </p>
          <div className="flex justify-center">
            <Button asChild size="lg" className="text-base">
              <a href={primary.url} target="_blank" rel="noopener noreferrer">
                Faire un don sur {primary.name}
                <span className="sr-only"> (ouvre un nouvel onglet)</span>
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4 max-w-md mx-auto">{rescritMessage()}</p>
        </CardContent>
      </Card>

      {/* Pourquoi soutenir */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Pourquoi nous soutenir ?</h2>
        <Card>
          <CardContent className="pt-6 prose prose-sm max-w-none">
            <p className="text-base leading-relaxed">
              <strong>Poligraph</strong> est un projet citoyen porté par l&apos;
              <strong>association Sankofa</strong> (loi 1901). Indépendant et sans financement
              partisan, nous refusons la publicité pour garantir notre neutralité.
            </p>
            <p className="text-base leading-relaxed mt-4">
              Notre mission : rendre accessible à tous les citoyens l&apos;information sur leurs
              représentants politiques. Votes, mandats, déclarations de patrimoine, affaires
              judiciaires : tout est sourcé et vérifiable.
            </p>
            <p className="text-base leading-relaxed mt-4">
              Vos dons nous permettent de couvrir les frais techniques et de développer de nouvelles
              fonctionnalités pour mieux vous informer.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Ce que vous financez */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Ce que vous financez</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES_FUNDED.map((feature) => (
            <div key={feature} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <span className="text-green-600 mt-0.5" aria-hidden="true">
                &#10003;
              </span>
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Transparence des coûts */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Transparence des coûts</h2>
        <p className="text-muted-foreground mb-6">
          Voici le détail de nos dépenses mensuelles. L&apos;association Sankofa s&apos;engage à une
          gestion transparente de vos contributions.
        </p>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-4">
              {EXPENSES.map((expense) => (
                <li
                  key={expense.label}
                  className="flex items-center justify-between py-2 border-b last:border-0 gap-4"
                >
                  <div>
                    <p className="font-medium">{expense.label}</p>
                    <p className="text-sm text-muted-foreground">{expense.description}</p>
                  </div>
                  <span className="font-mono text-sm shrink-0 whitespace-nowrap">
                    {expense.monthlyEuros}€/mois
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <span className="font-bold">Total mensuel estimé</span>
              <span className="font-mono font-bold whitespace-nowrap">{totalMonthly}€/mois</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Plateforme secondaire (Tipeee) */}
      {secondary.length > 0 && (
        <section className="mb-12">
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Vous préférez un soutien récurrent type tip jar, lié directement au projet Poligraph
                ?{" "}
                {secondary.map((platform, index) => (
                  <span key={platform.name}>
                    Vous pouvez aussi nous soutenir sur{" "}
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {platform.name}
                      <span className="sr-only"> (ouvre un nouvel onglet)</span>
                    </a>
                    {index < secondary.length - 1 ? " ou " : "."}
                  </span>
                ))}{" "}
                Cette plateforme n&apos;ouvre pas droit au reçu fiscal de l&apos;association.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Autres moyens d'aider */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Autres moyens d&apos;aider</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Partagez le projet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Parlez de Poligraph autour de vous, sur les réseaux sociaux, à vos proches. Plus
                nous sommes nombreux, plus notre voix porte.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Contribuez au code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Le projet est open source. Développeurs, data scientists, designers : vos
                contributions sont les bienvenues sur{" "}
                <a
                  href="https://github.com/ironlam/poligraph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  GitHub
                  <span className="sr-only"> (ouvre un nouvel onglet)</span>
                </a>
                .
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Signalez des erreurs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vous avez repéré une erreur, une donnée obsolète ? Contactez-nous via les{" "}
                <Link href="/mentions-legales" className="text-primary hover:underline">
                  mentions légales
                </Link>
                . Chaque correction améliore le projet.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Utilisez l&apos;API</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Journalistes, chercheurs, développeurs : notre{" "}
                <Link href="/docs/api" className="text-primary hover:underline">
                  API ouverte
                </Link>{" "}
                vous donne accès à toutes nos données. Créez vos propres analyses.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Merci */}
      <section>
        <Card className="bg-muted">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Merci !</h2>
            <p className="text-muted-foreground">
              Que vous choisissiez de nous soutenir financièrement ou autrement, merci de croire en
              ce projet citoyen. Ensemble, rendons la politique plus transparente.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
