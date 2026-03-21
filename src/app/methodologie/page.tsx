import { Metadata } from "next";
import Link from "next/link";
import {
  CERTAINTY_LABELS,
  CERTAINTY_COLORS,
  CERTAINTY_DESCRIPTIONS,
  type CertaintyLevel,
} from "@/config/certainty";
import { AFFAIR_SUPER_CATEGORY_LABELS, type AffairSuperCategory } from "@/config/labels";

export const metadata: Metadata = {
  title: "Méthodologie - Classification des affaires judiciaires",
  description:
    "Comment Poligraph classe et présente les affaires judiciaires des responsables politiques français",
  alternates: { canonical: "/methodologie" },
};

const CERTAINTY_ORDER: CertaintyLevel[] = ["ETABLI", "PRONONCE", "EN_COURS", "CLOS_FAVORABLE"];

const CERTAINTY_STATUSES: Record<CertaintyLevel, string[]> = {
  ETABLI: ["Condamnation définitive"],
  PRONONCE: ["Condamnation en première instance", "Appel en cours"],
  EN_COURS: [
    "Enquête préliminaire",
    "Instruction",
    "Mise en examen",
    "Renvoi devant le tribunal",
    "Procès en cours",
  ],
  CLOS_FAVORABLE: ["Relaxe", "Acquittement", "Non-lieu", "Prescription", "Classement sans suite"],
};

const SUPER_CATEGORIES: { key: AffairSuperCategory; description: string }[] = [
  {
    key: "PROBITE",
    description:
      "Infractions liées à l'exercice d'un mandat ou d'une fonction publique : corruption, détournement de fonds publics, prise illégale d'intérêts, financement illégal de campagne. Ces infractions sont spécifiques aux responsables publics (inspiré de la classification Sapin II).",
  },
  {
    key: "FINANCES",
    description:
      "Infractions financières de droit commun : fraude fiscale, abus de biens sociaux, blanchiment, escroquerie.",
  },
  {
    key: "PERSONNES",
    description:
      "Atteintes aux personnes : violences, harcèlement moral ou sexuel, agressions sexuelles, menaces.",
  },
  {
    key: "EXPRESSION",
    description:
      "Infractions liées à l'expression publique : diffamation, injure, provocation à la haine, apologie du terrorisme.",
  },
  {
    key: "AUTRE",
    description: "Infractions ne relevant pas des catégories précédentes.",
  },
];

export default function MethodologiePage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">Méthodologie</h1>
      <p className="text-muted-foreground mb-10">
        Comment Poligraph classe et présente les affaires judiciaires
      </p>

      {/* Section 1: Certainty levels */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold mb-4">Niveaux de certitude judiciaire</h2>
        <p className="text-muted-foreground mb-6">
          Chaque affaire est classée selon l{"'"}avancement de la procédure judiciaire. Ce
          classement reflète le degré de certitude juridique, pas la gravité de l{"'"}infraction.
        </p>
        <div className="space-y-4">
          {CERTAINTY_ORDER.map((level) => (
            <div key={level} className="rounded-lg border p-4">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CERTAINTY_COLORS[level]}`}
                >
                  {CERTAINTY_LABELS[level]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{CERTAINTY_DESCRIPTIONS[level]}</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {CERTAINTY_STATUSES[level].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Super-categories */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold mb-4">Types d{"'"}infractions</h2>
        <p className="text-muted-foreground mb-6">
          Les affaires sont regroupées en cinq grandes catégories, inspirées du cadre de la{" "}
          <Link
            href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000033558528"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            loi Sapin II
          </Link>{" "}
          pour la distinction entre infractions liées à la probité et infractions de droit commun.
        </p>
        <div className="space-y-3">
          {SUPER_CATEGORIES.map(({ key, description }) => (
            <div key={key} className="rounded-lg border p-4">
              <h3 className="font-medium mb-1">{AFFAIR_SUPER_CATEGORY_LABELS[key]}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Counting rules */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold mb-4">Règles de comptage</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-foreground mb-1">Affaires actives</h3>
            <p>
              Les compteurs affichés sur le site (profils, statistiques) ne prennent en compte que
              les affaires <strong>actives</strong> : niveaux Etabli, Prononcé et En cours. Les
              procédures closes favorablement (relaxe, acquittement, non-lieu, etc.) ne sont pas
              comptabilisées dans ces totaux, mais restent visibles sur la fiche détaillée.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-foreground mb-1">Implication directe uniquement</h3>
            <p>
              Seules les affaires où le politicien est directement impliqué (mis en cause, poursuivi
              ou condamné) sont comptabilisées. Les simples mentions dans une affaire tierce ou les
              cas où le politicien est victime/plaignant ne sont pas inclus dans les compteurs.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-foreground mb-1">Décompte par politicien</h3>
            <p>
              Les statistiques globales ({'"'}élus condamnés{'"'}, {'"'}élus mis en cause{'"'})
              comptent le nombre de politiciens uniques concernés, pas le nombre total d{"'"}
              affaires.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Presumption of innocence */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold mb-4">Présomption d{"'"}innocence</h2>
        <p className="text-muted-foreground text-sm">
          Conformément à l{"'"}article 9-1 du Code civil, toute personne mise en cause dans une
          procédure judiciaire est présumée innocente jusqu{"'"}à ce qu{"'"}elle ait été déclarée
          coupable par une décision de justice définitive. Cette mention apparaît systématiquement
          sur les fiches de politiciens concernés par des procédures en cours ou des condamnations
          non définitives. Le référencement d{"'"}une affaire sur Poligraph ne constitue en aucun
          cas un jugement de valeur.
        </p>
      </section>

      {/* Section 5: Victims/plaintiffs */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold mb-4">Victimes et plaignants</h2>
        <p className="text-muted-foreground text-sm">
          Lorsqu{"'"}un politicien est victime ou plaignant dans une affaire (violences, menaces,
          harcèlement), cette information est traitée séparément des affaires où il est mis en
          cause. Ces affaires ne sont jamais comptabilisées dans les indicateurs d{"'"}intégrité et
          apparaissent dans une section distincte sur le profil.
        </p>
      </section>

      {/* Section 6: Sources */}
      <section className="mb-8">
        <h2 className="text-xl font-display font-semibold mb-4">Sources</h2>
        <p className="text-muted-foreground text-sm">
          Chaque affaire judiciaire référencée sur Poligraph est documentée par au moins une source
          journalistique vérifiable (Le Monde, Mediapart, AFP, etc.). Les données officielles
          (Assemblée nationale, Sénat, gouvernement) prévalent sur les sources tierces. Pour plus de
          détails sur nos sources de données, consultez la page{" "}
          <Link href="/sources" className="text-primary hover:underline">
            Sources et méthodologie
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
