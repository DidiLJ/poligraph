import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Sources et Méthodologie",
  description:
    "Nos sources de données, notre méthodologie et notre engagement pour la transparence",
  alternates: { canonical: "/sources" },
};

const DATA_SOURCES = [
  {
    name: "Assemblée nationale",
    shortName: "AN",
    description: "Liste officielle des 577 députés, mandats, groupes parlementaires",
    url: "https://data.assemblee-nationale.fr/",
    frequency: "Quotidienne",
    fields: ["Identité", "Parti", "Circonscription", "Date de mandat", "Photo"],
    color: "#0066CC",
  },
  {
    name: "Sénat",
    shortName: "Sénat",
    description: "Liste officielle des 348 sénateurs via l'API du Sénat",
    url: "https://data.senat.fr",
    frequency: "Hebdomadaire",
    fields: ["Identité", "Groupe", "Circonscription", "Photo"],
    color: "#8B0000",
  },
  {
    name: "Gouvernement",
    shortName: "Gouv",
    description: "Historique des gouvernements de la Ve République",
    url: "https://data.gouv.fr",
    frequency: "À chaque remaniement",
    fields: ["Ministres", "Fonctions", "Dates de mandat"],
    color: "#000091",
  },
  {
    name: "HATVP",
    shortName: "HATVP",
    description: "Déclarations de patrimoine et d'intérêts des élus",
    url: "https://www.hatvp.fr/open-data/",
    frequency: "Mensuelle",
    fields: ["Déclarations patrimoine", "Déclarations intérêts", "Photos officielles"],
    color: "#00A86B",
  },
  {
    name: "Wikidata",
    shortName: "WD",
    description: "Données biographiques et affaires judiciaires documentées",
    url: "https://www.wikidata.org",
    frequency: "Hebdomadaire",
    fields: ["Dates de naissance", "Condamnations", "Photos Wikipedia"],
    color: "#006699",
  },
  {
    name: "NosDéputés / NosSénateurs",
    shortName: "ND/NS",
    description: "Activité parlementaire, votes nominatifs et données complémentaires",
    url: "https://www.nosdeputes.fr",
    frequency: "Quotidienne",
    fields: ["Photos", "Activité", "Votes nominatifs", "Scrutins"],
    color: "#FF6600",
  },
  {
    name: "Parlement Européen",
    shortName: "PE",
    description: "Données sur les 81 eurodéputés français",
    url: "https://data.europarl.europa.eu",
    frequency: "Mensuelle",
    fields: ["Identité", "Groupe politique", "Commission", "Photo"],
    color: "#003399",
  },
  {
    name: "Presse (RSS)",
    shortName: "Presse",
    description:
      "Articles politiques agrégés depuis les flux RSS de médias nationaux, avec détection automatique des mentions",
    url: null,
    frequency: "Quotidienne",
    fields: ["Articles", "Mentions politiciens", "Mentions partis"],
    color: "#E8A838",
  },
  {
    name: "Google Fact Check Tools API",
    shortName: "FC",
    description:
      "Fact-checks de sources reconnues (AFP Factuel, Les Décodeurs, etc.) via le standard ClaimReview",
    url: "https://toolbox.google.com/factcheck/explorer",
    frequency: "Quotidienne",
    fields: ["Déclarations vérifiées", "Verdicts", "Sources de fact-checking"],
    color: "#4285F4",
  },
  {
    name: "OpenSanctions",
    shortName: "OS",
    description:
      "Base internationale de personnes politiquement exposées (PEP) et de sanctions. Croisement automatique avec les profils Poligraph pour enrichir les identifiants externes",
    url: "https://www.opensanctions.org",
    frequency: "Hebdomadaire",
    fields: ["Statut PEP", "Identifiants croisés", "Jeux de données"],
    color: "#1a1a2e",
  },
  {
    name: "Datan",
    shortName: "Datan",
    description:
      "Statistiques parlementaires et informations de contact des deputes, publiees en open data sur data.gouv.fr",
    url: "https://www.data.gouv.fr/fr/datasets/deputes-actifs-de-lassemblee-nationale-informations-et-statistiques/",
    frequency: "Hebdomadaire",
    fields: ["Contact", "Reseaux sociaux", "Statistiques"],
    color: "#5770BE",
  },
];

const METHODOLOGY_POINTS = [
  {
    title: "Vérification des sources",
    description:
      "Chaque affaire judiciaire est documentée par au moins une source journalistique vérifiable. Nous privilégions les sources de presse nationale reconnue (Le Monde, Mediapart, AFP, etc.).",
  },
  {
    title: "Présomption d'innocence",
    description:
      "Toute personne mise en examen ou en cours de jugement est présumée innocente. Cette mention apparaît systématiquement sur les fiches concernées.",
  },
  {
    title: "Actualisation continue",
    description:
      "Les données sont mises à jour régulièrement via des scripts automatisés. Les affaires sont actualisées manuellement lors d'évolutions judiciaires significatives.",
  },
  {
    title: "Transparence totale",
    description:
      "Tout notre code source est disponible. Nous documentons nos sources et notre méthodologie. Les erreurs signalées sont corrigées rapidement.",
  },
];

const INCLUSION_CRITERIA = [
  {
    title: "Politiciens français uniquement",
    description:
      "Seuls les responsables politiques français sont référencés : élus nationaux, locaux, ministres et candidats aux élections majeures.",
    included: true,
  },
  {
    title: "Pertinence temporelle",
    description:
      "Les personnes décédées depuis plus de 10 ans ne sont pas incluses, sauf cas historiques exceptionnels liés à la Ve République.",
    included: true,
  },
  {
    title: "Mandat ou notoriété politique",
    description:
      "Les personnes référencées doivent avoir exercé un mandat politique OU être impliquées dans une affaire judiciaire en lien direct avec la politique française.",
    included: true,
  },
  {
    title: "Personnalités étrangères",
    description:
      "Les dirigeants étrangers, même impliqués dans des affaires avec la France, ne sont pas référencés.",
    included: false,
  },
  {
    title: "Figures historiques anciennes",
    description:
      "Les personnalités de l'Ancien Régime, des Républiques précédentes ou décédées avant 1958 sont exclues.",
    included: false,
  },
];

export default function SourcesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-4">
          Sources et Méthodologie
        </h1>
        <p className="text-lg text-muted-foreground">
          Notre engagement : des données vérifiables, une méthodologie transparente, et le respect
          de la présomption d&apos;innocence.
        </p>
      </div>

      {/* Manifesto */}
      <Card className="mb-12 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl">Notre Manifeste</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-base leading-relaxed">
            <strong>Poligraph</strong> est un projet citoyen indépendant qui rassemble les
            informations publiques sur les responsables politiques français : parcours, mandats,
            votes, déclarations et affaires judiciaires.
          </p>
          <p className="text-base leading-relaxed mt-4">
            La démocratie repose sur des citoyens informés. Nous facilitons l&apos;accès à des
            données dispersées entre de nombreuses sources officielles pour permettre à chacun
            d&apos;exercer son droit de regard sur ses représentants.
          </p>
          <p className="text-base leading-relaxed mt-4">
            Nous appliquons les mêmes critères à tous les élus, indépendamment de leur appartenance
            partisane. Les données proviennent de sources officielles (Assemblée nationale, Sénat,
            HATVP) et sont documentées de façon transparente.
          </p>
          <p className="text-base leading-relaxed mt-4">
            Ce projet est <strong>open source</strong> et contributif. Le code, les données et la
            méthodologie sont accessibles à tous.
          </p>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Nos Sources de Données</h2>
        <div className="grid gap-4">
          {DATA_SOURCES.map((source) => (
            <Card key={source.shortName}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        style={{
                          backgroundColor: `${source.color}20`,
                          color: source.color,
                        }}
                      >
                        {source.shortName}
                      </Badge>
                      <h3 className="font-semibold">{source.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{source.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {source.fields.map((field) => (
                        <Badge key={field} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mise à jour : {source.frequency}
                    </p>
                  </div>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline shrink-0"
                    >
                      Source
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Notre Méthodologie</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {METHODOLOGY_POINTS.map((point) => (
            <Card key={point.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{point.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{point.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Classification des affaires */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Classification des Affaires Judiciaires</h2>
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Les affaires judiciaires sont classées selon une grille inspirée de la{" "}
                <strong>loi Sapin II</strong> (loi n° 2016-1691 du 9 décembre 2016 relative à la
                transparence, à la lutte contre la corruption et à la modernisation de la vie
                économique) et du cadre légal des <strong>atteintes à la probité</strong> défini par
                le Code pénal.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Niveaux de gravité</h3>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>
                    <strong className="text-red-700 dark:text-red-400">
                      Atteinte à la probité
                    </strong>{" "}
                    : infractions intrinsèquement liées à l&apos;exercice du mandat public
                    (corruption, trafic d&apos;influence, prise illégale d&apos;intérêts,
                    favoritisme, détournement de fonds publics, emploi fictif, financement illégal
                    de campagne ou de parti)
                  </li>
                  <li>
                    <strong className="text-orange-700 dark:text-orange-400">
                      Infraction grave
                    </strong>{" "}
                    : fraude fiscale, blanchiment, abus de biens sociaux, harcèlement, agressions
                  </li>
                  <li>
                    <strong className="text-gray-700 dark:text-gray-400">Autre infraction</strong> :
                    infractions de droit commun sans lien direct avec le mandat (diffamation,
                    injure, violence)
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Règles de classification</h3>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>
                    La gravité est <strong>calculée automatiquement</strong> à partir de la
                    catégorie d&apos;infraction et du lien avec le mandat
                  </li>
                  <li>
                    Les catégories de probité (corruption, trafic d&apos;influence, etc.) sont{" "}
                    <strong>par définition</strong> liées au mandat, sans intervention manuelle
                  </li>
                  <li>
                    Une infraction de droit commun commise dans le cadre du mandat est{" "}
                    <strong>promue d&apos;un niveau</strong> de gravité
                  </li>
                </ul>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm text-muted-foreground">
                  <strong>
                    Cette classification ne reflète pas la gravité morale ou pénale des faits.
                  </strong>{" "}
                  Elle distingue les infractions spécifiques à l&apos;exercice d&apos;un mandat
                  public (atteintes à la probité, au sens de la loi Sapin II) des autres infractions
                  pénales. Une agression sexuelle ou un acte de violence est pénalement plus
                  sévèrement puni qu&apos;un conflit d&apos;intérêts, mais n&apos;est pas spécifique
                  à la fonction d&apos;élu.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Violences et menaces contre les elus */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">Violences et menaces contre les elus</h2>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Poligraph documente egalement les affaires judiciaires dans lesquelles un elu est
              victime ou plaignant (menaces, violences, harcelement). Ces affaires repondent aux
              memes criteres d{"'"}inclusion que les affaires ou l{"'"}elu est mis en cause :
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Source verifiable</strong> : au moins une source journalistique de reference
                ou une decision de justice publique. Le signalement par l{"'"}elu seul ne suffit
                pas.
              </li>
              <li>
                <strong>Statut judiciaire reel</strong> : une plainte deposee est affichee avec son
                statut (enquete preliminaire, instruction, etc.), jamais comme un fait etabli.
              </li>
              <li>
                <strong>Pas de comparaisons partisanes</strong> : les statistiques sont presentees
                en chiffres agreges, sans ventilation par parti politique.
              </li>
              <li>
                <strong>Distinction des roles</strong> : Victime (cible directe de l{"'"}infraction)
                et Plaignant (personne ayant initie la procedure) sont distingues. Un elu portant
                plainte en diffamation est plaignant, pas victime.
              </li>
            </ul>
            <p>
              Lorsque l{"'"}auteur presume des faits est egalement un elu suivi par Poligraph, les
              deux fiches d{"'"}affaire sont liees pour permettre une lecture complete.
            </p>
          </div>
        </div>
      </section>

      {/* Intelligence artificielle */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Intelligence Artificielle</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Poligraph utilise l&apos;intelligence artificielle de manière ciblée et transparente :
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>
                <strong>Classification</strong> : catégorise les textes législatifs dans 13 thèmes
              </li>
              <li>
                <strong>Analyse de presse</strong> : détecte les mentions de politiciens dans les
                articles
              </li>
              <li>
                <strong>Modération</strong> : aide à la vérification des données judiciaires
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              L&apos;IA n&apos;est pas utilisée pour rédiger des contenus éditoriaux. Certains
              champs descriptifs (biographies, résumés) ont été générés à partir des données
              structurées Wikidata présentes en base, puis validés manuellement. Toutes les sources
              de données sont réelles et vérifiables.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Inclusion Criteria */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Critères de Pertinence</h2>
        <p className="text-muted-foreground mb-6">
          Pour garantir la qualité et la pertinence des données, nous appliquons des critères
          stricts de sélection des personnes référencées.
        </p>
        <div className="grid gap-4">
          {INCLUSION_CRITERIA.map((criterion) => (
            <Card
              key={criterion.title}
              className={
                criterion.included
                  ? "border-green-200 dark:border-green-900"
                  : "border-red-200 dark:border-red-900"
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <span
                    className={`text-lg ${criterion.included ? "text-green-600" : "text-red-600"}`}
                  >
                    {criterion.included ? "✓" : "✗"}
                  </span>
                  <div>
                    <h3 className="font-semibold mb-1">
                      {criterion.included ? "Inclus" : "Exclus"} : {criterion.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{criterion.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Couverture et limites */}
      <section id="couverture" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-bold mb-6">Couverture et Limites</h2>
        <div className="grid gap-4">
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ce que nous couvrons</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>
                  <strong>577 députés</strong> de l&apos;Assemblée nationale (16e et 17e
                  législatures)
                </li>
                <li>
                  <strong>348 sénateurs</strong> du Sénat
                </li>
                <li>
                  <strong>81 eurodéputés</strong> français au Parlement européen
                </li>
                <li>
                  <strong>Gouvernements de la Ve République</strong> : ministres, secrétaires
                  d&apos;État, historique complet
                </li>
                <li>
                  <strong>Présidents de parti</strong> : dirigeants actuels des formations
                  politiques
                </li>
                <li>
                  <strong>Affaires judiciaires</strong> documentées avec sources vérifiables
                </li>
                <li>
                  <strong>Déclarations HATVP</strong> : patrimoine et intérêts des élus
                </li>
                <li>
                  <strong>Votes parlementaires</strong> : scrutins publics de l&apos;AN et du Sénat
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Limites connues</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>
                  <strong>Élus locaux partiellement couverts</strong> : seuls les maires, présidents
                  de région et de département ayant un mandat national sont systématiquement
                  référencés
                </li>
                <li>
                  <strong>Figures politiques sans mandat actuel</strong> : certaines personnalités
                  (candidats, anciens élus) peuvent ne pas apparaître si elles n&apos;ont pas de
                  mandat enregistré dans nos sources
                </li>
                <li>
                  <strong>Candidats non élus</strong> : les candidats aux élections qui n&apos;ont
                  jamais été élus ne sont généralement pas référencés
                </li>
                <li>
                  <strong>Délai de mise à jour</strong> : les données sont synchronisées
                  quotidiennement, un décalage de quelques heures est possible
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Enrichissement progressif</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Notre base de données est enrichie en croisant <strong>10 sources</strong>{" "}
                différentes (Assemblée nationale, Sénat, Gouvernement, Parlement européen, HATVP,
                Wikidata, NosDéputés, presse, fact-checks, Datan). Chaque source apporte des
                informations complémentaires.
              </p>
              <p className="text-sm text-muted-foreground">
                Ce projet est <strong>open source</strong> et contributif. Si vous constatez une
                absence ou une erreur, n&apos;hésitez pas à{" "}
                <Link href="/mentions-legales" className="text-primary hover:underline">
                  nous contacter
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Legal Notice */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Cadre Légal</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Présomption d&apos;innocence</h3>
              <p className="text-sm text-muted-foreground">
                Conformément à l&apos;article 9-1 du Code civil, toute personne a droit au respect
                de la présomption d&apos;innocence. Les affaires en cours ne préjugent en rien de la
                culpabilité des personnes concernées.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Droit de réponse</h3>
              <p className="text-sm text-muted-foreground">
                Toute personne citée dispose d&apos;un droit de réponse. Les demandes de correction
                ou de mise à jour peuvent être adressées via notre formulaire de contact.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Données personnelles</h3>
              <p className="text-sm text-muted-foreground">
                Les données publiées sont issues de sources publiques officielles. Conformément au
                RGPD, les personnes concernées peuvent exercer leurs droits d&apos;accès, de
                rectification et d&apos;opposition.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Fonctionnalités */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Fonctionnalités</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Votes parlementaires</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Consultez les votes nominatifs de chaque député sur les scrutins publics. Importés
                depuis NosDéputés.fr pour la 16e législature.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Graphe de relations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualisez les connexions entre politiciens : même parti, même gouvernement, même
                législature, même département.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">API publique</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Accédez à nos données via une API REST documentée avec OpenAPI/Swagger.
                <Link href="/docs/api" className="text-primary hover:underline ml-1">
                  Voir la documentation
                </Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Déclarations HATVP</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Liens directs vers les déclarations de patrimoine et d&apos;intérêts publiées par la
                Haute Autorité pour la Transparence de la Vie Publique.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Fact-checks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vérification des déclarations des politiciens par des organismes reconnus (AFP
                Factuel, Les Décodeurs, etc.) via la Google Fact Check Tools API.
                <Link href="/factchecks" className="text-primary hover:underline ml-1">
                  Voir les fact-checks
                </Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Revue de presse</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Articles politiques agrégés depuis Le Monde, Politico et Mediapart, avec détection
                automatique des politiciens et partis mentionnés.
                <Link href="/presse" className="text-primary hover:underline ml-1">
                  Voir la revue de presse
                </Link>
              </p>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Chatbot IA{" "}
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  À venir
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Assistant conversationnel basé sur nos données (RAG), avec citations obligatoires et
                rappel de la présomption d&apos;innocence.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Architecture Technique */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Architecture Technique</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Notre système utilise une architecture multi-sources permettant de croiser et enrichir
              les données provenant de différentes origines :
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>
                <strong>Identifiants uniques</strong> : Chaque politicien est lié à ses identifiants
                dans chaque source (AN, Sénat, PE, Wikidata, HATVP)
              </li>
              <li>
                <strong>Matching intelligent</strong> : Recherche par ID externe, puis par nom avec
                gestion des variantes (particules, accents)
              </li>
              <li>
                <strong>Priorité des sources</strong> : Les données officielles (AN, Sénat,
                Gouvernement) prévalent sur les sources tierces
              </li>
              <li>
                <strong>Traçabilité</strong> : Chaque donnée conserve sa source d&apos;origine
              </li>
              <li>
                <strong>Synchronisation automatique</strong> : Mise à jour quotidienne via GitHub
                Actions (3x/jour)
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Contact */}
      <section>
        <Card className="bg-muted">
          <CardContent className="pt-6 text-center">
            <h3 className="font-semibold mb-2">Une erreur ? Une suggestion ?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Nous nous engageons à corriger rapidement toute erreur signalée.
            </p>
            <Link href="/mentions-legales" className="text-sm text-primary hover:underline">
              Nous contacter via les mentions légales
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
