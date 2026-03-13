# Comment on a arrete de confondre les politiques : construire un moteur de resolution d'identite pour les donnees civiques francaises

_Construire un systeme de resolution d'entites pour un projet civic tech de petite echelle : retours pratiques depuis la zone grise entre la theorie ER academique et les plateformes MDM d'entreprise._

---

## Le bug qui a tout declenche

Thierry Cousin est maire de Saint-Pryve-Saint-Mesmin, une petite commune du Loiret. Il a ete condamne dans une affaire de malversation financiere, et Poligraph (notre observatoire civique des politiques francais) suit correctement cette affaire.

Thierry Cousin est aussi maire de Betoncourt-Saint-Pancras, un village de Haute-Saone. Il n'a aucun casier judiciaire.

Pendant des mois, notre systeme a cru qu'il s'agissait de la meme personne.

Le sync RNE (Repertoire National des Elus) avait rattache le mandat de maire du second Thierry Cousin au profil du premier, parce qu'il avait trouve exactement un "Thierry Cousin" dans notre base et l'avait retourne sans verifier la date de naissance. Le profil du politique condamne affichait desormais un mandat pour une commune situee a 400km.

Ce n'est pas qu'un simple bug de qualite de donnees, c'est un probleme de credibilite. Quand une plateforme civic tech attribue une condamnation penale a la mauvaise personne, les consequences depassent la dette technique. Une affaire mal attribuee peut porter atteinte a la reputation de quelqu'un. Une affaire manquante peut compromettre la transparence.

Il fallait corriger ca proprement, pas avec un nouveau pansement.

## Nos premiers essais

Notre architecture initiale etait simple : chaque service de synchronisation (deputes, senateurs, maires, declarations, decisions de justice) avait sa propre fonction de matching. Le schema etait toujours le meme :

```
1. Normaliser le nom
2. Chercher dans la base les noms correspondants
3. Si un seul resultat : le retourner
4. Si plusieurs : essayer la date de naissance, puis le departement
5. Si toujours ambigu : prendre le premier (ou abandonner)
```

Quand le bug Thierry Cousin a fait surface, on a ajoute une verification de date de naissance pour les candidats uniques. Probleme resolu ?

Pas vraiment. Le correctif traitait un symptome, mais l'architecture sous-jacente restait fragile :

- **10 services de sync, 10 implementations de matching.** Chacune legerement differente, chacune source potentielle de bugs d'homonymie.
- **Pas de memoire partagee.** Si on avait signale "Thierry Cousin de Haute-Saone n'est PAS la meme personne que Thierry Cousin du Loiret", cette decision vivait dans la tete du developpeur, pas dans le systeme.
- **Pas de trace d'audit.** Quand un matching se produisait, c'etait invisible. Pas de score de confiance, pas d'attribution de methode, aucun moyen de revoir ou d'annuler.
- **Pas de decisions negatives.** Le systeme pouvait dire "ce sont la meme personne" mais n'avait aucun moyen de dire "ce ne sont CERTAINEMENT PAS la meme personne." Chaque sync pouvait donc potentiellement recreer le meme mauvais matching.

## Ce que dit l'etat de l'art

Avant de concevoir notre solution, nous avons etudie comment d'autres resolvent la resolution d'entites (ER) :

**Fellegi-Sunter (1969) :** le modele fondateur de couplage probabiliste d'enregistrements. Compare les champs independamment, accumule des poids de matching/non-matching, prend des decisions sur la base de scores composites. Notre matching ad-hoc en etait une version informelle et non structuree.

**OpenSanctions / nomenklatura :** la reference la plus pertinente pour notre cas d'usage. OpenSanctions maintient 130K+ profils d'entites a travers les listes de sanctions, les bases PEP et les registres d'entreprises. Leur librairie `nomenklatura` utilise un graphe de jugements : les paires d'enregistrements sont connectees par des aretes SAME, NOT_SAME ou UNDECIDED. Un algorithme de composantes connexes calcule les clusters d'entites. Point cle : ils ont eu besoin de 34 600 decisions manuelles sur 8 semaines pour amorcer le systeme. Les decisions negatives (NOT_SAME) sont aussi importantes que les positives.

**EveryPolitician (mySociety) :** un projet qui tentait de maintenir des donnees exhaustives sur chaque politicien dans le monde. Ils utilisaient des UUIDs + des tableaux Popolo `identifiers[]` + Wikidata comme hub de liaison. Le projet a ete archive au bout de 4 ans : la charge de maintenance de la reconciliation multi-sources etait insoutenable sans outillage adequat. Un avertissement utile.

**W3C Reconciliation API v0.2 :** une specification standard pour les services de matching d'entites. Wikidata l'implemente. Permet l'interop avec des outils comme OpenRefine pour la reconciliation par lots.

**Splink / Dedupe :** des librairies ER de production en Python. Puissantes pour le matching probabiliste a grande echelle, mais completement surdimensionnees pour nos 2 000 politiques. Stack technologique differente, en plus.

**Constat cle :** a notre echelle, le matching deterministe (identifiants institutionnels partages) couvre 80%+ des cas. La piece manquante critique n'etait pas un algorithme de matching plus sophistique, c'etait la **trace d'audit + les decisions negatives**.

## La conception : trois briques de base

### 1. Le Resolver : un pipeline unique pour les gouverner tous

Au lieu de 10 services de sync avec chacun son propre matching, on a construit un seul `IdentityResolver` avec un pipeline en 7 etapes :

```
Decisions anterieures → ExternalId → Date de naissance → Departement → Nom seul → Seuil → Log
```

Chaque etape produit un resultat ou passe la main a la suivante. Le scoring est gradue :

| Signal                     | Confiance | Justification                                 |
| -------------------------- | --------- | --------------------------------------------- |
| Identifiant institutionnel | 1.0       | Deterministe : meme code PA = meme depute     |
| Nom + date de naissance    | 0.9       | Fort mais pas infaillible (erreurs de saisie) |
| Nom + departement          | 0.7       | Moyen : plusieurs politiques par departement  |
| Nom seul                   | 0.5       | Peu fiable : sous le seuil d'auto-matching    |

Trois zones de decision :

- **>= 0.95** : Auto-match. Le systeme est suffisamment confiant.
- **0.70 - 0.94** : File d'attente de revue. Un humain doit confirmer.
- **< 0.70** : Rejet. Traiter comme une personne nouvelle, non matchee.

### 2. Le journal de decisions : le systeme se souvient

Chaque decision de matching est enregistree dans une table `IdentityDecision` :

```
sourceType: RNE
sourceId: "70069"
politicianId: "cmlrjqfpq..."
judgement: NOT_SAME
confidence: 1.0
method: MANUAL
decidedBy: "admin:ldiaby"
```

Cela remplit trois fonctions :

1. **Blocage.** Une decision NOT_SAME empeche le meme mauvais matching de se reproduire. La prochaine fois que le sync RNE rencontrera "Thierry Cousin" de Haute-Saone, il verifiera d'abord le journal de decisions et ignorera le mauvais politicien.

2. **Voie rapide.** Une decision SAME a haute confiance permet au resolver de retourner immediatement sans recalculer le matching. C'est particulierement utile pour les sources synchronisees quotidiennement.

3. **Auditabilite.** Chaque matching peut etre retrace jusqu'a ses preuves. Quand quelque chose semble incorrect, on peut trouver exactement quand, comment et pourquoi le matching a ete fait, et le remplacer par une decision corrigee.

### 3. Le score de confiance : tous les matchings ne se valent pas

Chaque lien ExternalId porte desormais des metadonnees :

```
source: RNE
externalId: "45321"
confidence: 0.9
matchedBy: BIRTHDATE
verifiedAt: null
verifiedBy: null
```

Cela nous dit non seulement _qu'un_ lien existe, mais _a quel point_ il est fiable et _comment_ il a ete etabli. Un depute AN matche par identifiant institutionnel (confiance 1.0) est qualitativement different d'un maire RNE matche par nom + departement (confiance 0.7).

## Le poligraphId et l'API de reconciliation

Chaque politicien recoit un identifiant public stable : de `PG-000001` a `PG-001781` (et ca augmente). Contrairement aux slugs (qui peuvent changer lors de corrections de noms) ou aux IDs de base de donnees (qui sont internes), le poligraphId est concu pour un usage externe.

Nous avons aussi implemente l'API W3C Reconciliation Service, permettant aux outils externes de matcher leurs jeux de donnees avec Poligraph :

```
GET /api/reconcile?queries={"q0":{"query":"Marine Le Pen"}}
```

Cela permet :

- **Integration OpenRefine.** Les datajournalistes peuvent reconcilier leurs tableurs avec notre base de politiques.
- **Interop Wikidata.** Notre Wikibot peut utiliser le point de reconciliation pour decouvrir de nouveaux liens.
- **Integrations partenaires.** D'autres projets civic tech peuvent verifier l'identite des politiques par rapport a nos donnees.

## Cas limite : les doubles noms de famille entre sources de donnees

La normalisation des noms (suppression des accents, mise en minuscules) corrige la plupart des variations orthographiques. Mais certaines divergences sont structurelles.

La maire de Vincennes est enregistree dans le RNE sous le nom "Charlotte Libert Albanel" (double nom de famille). Dans le CSV des candidatures municipales 2026 sur data.gouv.fr, la meme personne apparait comme "Charlotte LIBERT" (nom simple, tel qu'imprime sur le bulletin de vote). L'enrichissement par date de naissance RNE construit une cle de recherche a partir du nom complet normalise :

```
charlotte|libert albanel|94
```

La recherche cote candidature cherche :

```
charlotte|libert|94
```

Pas de correspondance. Sans l'enrichissement par date de naissance, le resolver d'identite a moins de signal, et la candidate reste non liee a sa fiche politicien.

Le correctif : pour les noms de famille a plusieurs mots, indexer aussi par le nom de famille primaire (premier mot). "Libert Albanel" produit une cle de repli sur "libert", que la recherche cote candidature trouve. Pour eviter les faux positifs, deux garde-fous :

- **Les particules courtes sont ignorees.** "De La Fontaine" ne produit pas de repli sur "de" (2 caracteres ou moins). Idem pour "Le Pen", "Du Bois", etc.
- **Detection d'ambiguite.** Si deux elus differents produiraient la meme cle de repli dans le meme departement (par exemple une "Charlotte Libert" et une "Charlotte Libert Albanel" toutes deux dans le 94), le repli est supprime pour les deux. Seuls les raccourcis non ambigus sont conserves.

Ce schema (noms composes dans une source, noms simples dans l'autre) est courant dans les donnees administratives francaises. Le RNE utilise le nom legal complet issu de l'acte de naissance. Les listes electorales utilisent le nom de bulletin, souvent plus court. Nom marital versus nom de naissance est une autre variante frequente.

## Lecons apprises

**1. Les faux positifs sont pires que les faux negatifs dans les donnees civiques.**

Attribuer une condamnation a la mauvaise personne a des consequences juridiques et de reputation. Ne pas trouver de correspondance signifie simplement des donnees incompletes. On a concu le systeme pour etre conservateur : dans le doute, ne pas matcher.

**2. Le matching deterministe couvre 80%+. Il faut investir la d'abord.**

La plupart de nos politiques viennent de sources institutionnelles avec des identifiants propres (AN, Senat, HATVP). Les cas difficiles (maires RNE, decisions de justice, articles de presse) sont minoritaires. Construire un traitement robuste pour les 80% faciles avant d'attaquer les 20% flous etait la bonne sequence.

**3. Stocker les decisions negatives. Elles ont autant de valeur que les positives.**

La decision NOT_SAME est sans doute la fonctionnalite la plus importante. Sans elle, chaque sync pouvait recreer le bug Thierry Cousin. Avec elle, une seule intervention manuelle bloque definitivement les mauvais matchings.

**4. Ne pas construire EveryPolitician.**

EveryPolitician de mySociety etait une tentative ambitieuse de maintenir les donnees de chaque politicien dans le monde. Le projet a echoue parce que la reconciliation multi-sources a grande echelle est un cauchemar de maintenance. On a cadre strictement : politiques francais uniquement, 10 sources curees, pipeline automatise avec revue humaine pour les cas limites.

**5. La normalisation des noms est necessaire mais pas suffisante.**

La suppression des accents et la mise en minuscules resolvent les variations orthographiques de surface. Mais les differences structurelles entre sources de donnees (doubles noms, noms de bulletin vs. noms legaux, noms de jeune fille vs. noms maritaux) necessitent un traitement dedie. Chaque nouvelle source de donnees apporte ses propres conventions de nommage, et on continue de decouvrir des cas limites.

## La suite

Le moteur de resolution d'identite est en production pour le sync RNE (35 000+ maires). Prochaines etapes :

- **Migrer les 9 services de sync restants** vers le resolver centralise.
- **Construire une interface admin** pour la file de revue (decisions UNDECIDED).
- **Reconciliation assistee par LLM :** utiliser Claude pour analyser les cas ambigus avec des indices contextuels depuis Wikipedia/presse.
- **Sync bidirectionnel Wikidata :** publier les poligraphIds comme identifiants externes Wikidata, bouclant la boucle d'interoperabilite.

L'objectif est un systeme ou chaque politicien dans Poligraph a une chaine claire et auditable depuis les donnees sources jusqu'au profil, et ou des erreurs comme celle de Thierry Cousin sont detectees avant d'arriver en production.

---

_Poligraph est un observatoire civique open-source qui suit les politiques francais. Le code est disponible sur [GitHub](https://github.com/ldiaby/politic-tracker)._
