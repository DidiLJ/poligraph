# Comment on a arrêté de confondre les politiques : construire un moteur de résolution d'identité pour les données civiques françaises

_Construire un système de résolution d'entités pour un projet civic tech de petite échelle : retours pratiques depuis la zone grise entre la théorie ER académique et les plateformes MDM d'entreprise._

---

## Le bug qui a tout déclenché

Thierry Cousin est maire de Saint-Pryvé-Saint-Mesmin, une petite commune du Loiret. Il a été condamné dans une affaire de malversation financière, et Poligraph (notre observatoire civique des politiques français) suit correctement cette affaire.

Thierry Cousin est aussi maire de Bétoncourt-Saint-Pancras, un village de Haute-Saône. Il n'a aucun casier judiciaire.

Pendant des mois, notre système a cru qu'il s'agissait de la même personne.

Le sync RNE (Répertoire National des Élus) avait rattaché le mandat de maire du second Thierry Cousin au profil du premier, parce qu'il avait trouvé exactement un "Thierry Cousin" dans notre base et l'avait retourné sans vérifier la date de naissance. Le profil du politique condamné affichait désormais un mandat pour une commune située à 400km.

Ce n'est pas qu'un simple bug de qualité de données, c'est un problème de crédibilité. Quand une plateforme civic tech attribue une condamnation pénale à la mauvaise personne, les conséquences dépassent la dette technique. Une affaire mal attribuée peut porter atteinte à la réputation de quelqu'un. Une affaire manquante peut compromettre la transparence.

Il fallait corriger ça proprement, pas avec un nouveau pansement.

## Nos premiers essais

Notre architecture initiale était simple : chaque service de synchronisation (députés, sénateurs, maires, déclarations, décisions de justice) avait sa propre fonction de matching. Le schéma était toujours le même :

```
1. Normaliser le nom
2. Chercher dans la base les noms correspondants
3. Si un seul résultat : le retourner
4. Si plusieurs : essayer la date de naissance, puis le département
5. Si toujours ambigu : prendre le premier (ou abandonner)
```

Quand le bug Thierry Cousin a fait surface, on a ajouté une vérification de date de naissance pour les candidats uniques. Problème résolu ?

Pas vraiment. Le correctif traitait un symptôme, mais l'architecture sous-jacente restait fragile :

- **10 services de sync, 10 implémentations de matching.** Chacune légèrement différente, chacune source potentielle de bugs d'homonymie.
- **Pas de mémoire partagée.** Si on avait signalé "Thierry Cousin de Haute-Saône n'est PAS la même personne que Thierry Cousin du Loiret", cette décision vivait dans la tête du développeur, pas dans le système.
- **Pas de trace d'audit.** Quand un matching se produisait, c'était invisible. Pas de score de confiance, pas d'attribution de méthode, aucun moyen de revoir ou d'annuler.
- **Pas de décisions négatives.** Le système pouvait dire "ce sont la même personne" mais n'avait aucun moyen de dire "ce ne sont CERTAINEMENT PAS la même personne." Chaque sync pouvait donc potentiellement recréer le même mauvais matching.

## Ce que dit l'état de l'art

Avant de concevoir notre solution, nous avons étudié comment d'autres résolvent la résolution d'entités (ER) :

**Fellegi-Sunter (1969) :** le modèle fondateur de couplage probabiliste d'enregistrements. Compare les champs indépendamment, accumule des poids de matching/non-matching, prend des décisions sur la base de scores composites. Notre matching ad-hoc en était une version informelle et non structurée.

**OpenSanctions / nomenklatura :** la référence la plus pertinente pour notre cas d'usage. OpenSanctions maintient 130K+ profils d'entités à travers les listes de sanctions, les bases PEP et les registres d'entreprises. Leur librairie `nomenklatura` utilise un graphe de jugements : les paires d'enregistrements sont connectées par des arêtes SAME, NOT_SAME ou UNDECIDED. Un algorithme de composantes connexes calcule les clusters d'entités. Point clé : ils ont eu besoin de 34 600 décisions manuelles sur 8 semaines pour amorcer le système. Les décisions négatives (NOT_SAME) sont aussi importantes que les positives.

**EveryPolitician (mySociety) :** un projet qui tentait de maintenir des données exhaustives sur chaque politicien dans le monde. Ils utilisaient des UUIDs + des tableaux Popolo `identifiers[]` + Wikidata comme hub de liaison. Le projet a été archivé au bout de 4 ans : la charge de maintenance de la réconciliation multi-sources était insoutenable sans outillage adéquat. Un avertissement utile.

**W3C Reconciliation API v0.2 :** une spécification standard pour les services de matching d'entités. Wikidata l'implémente. Permet l'interop avec des outils comme OpenRefine pour la réconciliation par lots.

**Constat clé :** à notre échelle, le matching déterministe (identifiants institutionnels partagés) couvre 80%+ des cas. Les pièces manquantes critiques étaient la **trace d'audit + les décisions négatives** (Phase 1), puis le **scoring probabiliste avec pondération par fréquence de nom** (Phase 2).

## Phase 1 : les fondations

### Le Resolver : un pipeline unique pour les gouverner tous

Au lieu de 10 services de sync avec chacun son propre matching, on a construit un seul `IdentityResolver` avec un pipeline centralisé :

```
Décisions antérieures -> ExternalId -> Évaluation des signaux -> Combineur -> Seuil -> Log
```

Chaque étape produit un résultat ou passe la main à la suivante. Nous avons introduit une **architecture à base de signaux** : des évaluateurs composables qui mesurent chacun une dimension du matching (date de naissance, département, prénom, genre).

### Le journal de décisions : le système se souvient

Chaque décision de matching est enregistrée dans une table `IdentityDecision` :

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

1. **Blocage.** Une décision NOT_SAME empêche le même mauvais matching de se reproduire. La prochaine fois que le sync RNE rencontrera "Thierry Cousin" de Haute-Saône, il vérifiera d'abord le journal de décisions et ignorera le mauvais politicien.

2. **Voie rapide.** Une décision SAME à haute confiance permet au resolver de retourner immédiatement sans recalculer le matching. C'est particulièrement utile pour les sources synchronisées quotidiennement.

3. **Auditabilité.** Chaque matching peut être retracé jusqu'à ses preuves. Quand quelque chose semble incorrect, on peut trouver exactement quand, comment et pourquoi le matching a été fait, et le remplacer par une décision corrigée.

## Phase 2 : le scoring probabiliste Fellegi-Sunter

La Phase 1 a résolu le problème d'architecture, mais le scoring restait simpliste : correspondance de date de naissance = 0.9, département = 0.7, nom seul = 0.5. Cela signifiait que "Jean-Pierre Martin" (l'un des noms les plus courants en France) obtenait la même confiance que "Jean-Luc Mélenchon" (essentiellement unique). On traitait tous les noms comme également informatifs, ce qui est manifestement faux.

### Le pipeline de signaux

Nous avons étendu le resolver pour évaluer **7 signaux indépendants**, chacun produisant un **log-likelihood ratio** (logLR) : les valeurs positives soutiennent un match, les valeurs négatives soutiennent un non-match.

```
                        +------------------------------+
  ResolveInput -------->|     Pipeline de signaux (7)   |
  (nom, date,           |                               |
   département,         |  birthdate    -- logLR --+    |
   genre, ...)          |  department   -- logLR --+    |
                        |  first-name   -- logLR --+    |
                        |  gender       -- logLR --+--> Fellegi-Sunter
  CachedPolitician ---->|  name-freq    -- logLR --+    Combiner
  (candidat en base)    |  temporal     -- logLR --+    |
                        |  party-ctx    -- logLR --+    |
                        +------------------------------+
```

Les signaux :

| Signal         | Ce qu'il mesure                           | logLR typique                      |
| -------------- | ----------------------------------------- | ---------------------------------- |
| birthdate      | Correspondance exacte ou approximative    | +6.0 (exact), -6.0 (mismatch)      |
| department     | Mandat dans le même département           | +3.0                               |
| first-name     | Correspondance phonétique/fuzzy du prénom | +3.0 (exact), -5.0 (mismatch)      |
| gender         | Correspondance du genre                   | +1.0 (match), -6.0 (pénalité dure) |
| name-frequency | Rareté du nom de famille                  | +6.9 (Martin) à +16.6 (Mélenchon)  |
| temporal       | Chevauchement de mandats actifs           | +2.5 (chevauchement), -0.5 (gap)   |
| party-context  | Même parti mentionné dans le texte source | +2.0                               |

### La pondération par fréquence de nom

C'est l'innovation clé. Au lieu de traiter tous les noms de famille de façon égale, le signal `name-frequency` utilise la distribution réelle des noms dans notre base de 36 000+ politiciens :

- **Nom rare** (ex. "Mélenchon", fréquence ~0.001%) : `logLR = log2(1/0.00001) = 16.6`. Un match sur un nom rare constitue une évidence forte.
- **Nom commun** (ex. "Martin", fréquence ~0.8%) : `logLR = log2(1/0.008) = 6.9`. Un match sur un nom commun constitue une évidence plus faible.

Le matching supporte aussi le **fuzzy matching** : si le score Jaro-Winkler entre les noms est >= 0.92 (ex. "Lefebvre"/"Lefèvbre"), un logLR réduit de 20% est attribué.

### Le combineur Fellegi-Sunter

Le combineur somme les logLR de tous les signaux puis convertit en confiance via une sigmoïde : `confidence = 1 / (1 + 2^(-compositeLogLR))`.

Les seuils de décision sont basés sur le logLR composite :

- **SAME** : logLR >= 12.0 (confiance >= 99.97%)
- **UNDECIDED** : logLR entre 4.0 et 12.0 (file d'attente de revue humaine)
- **NOT_SAME** : logLR < 4.0

Le combineur supporte aussi des **pénalités dures** : certains signaux (ex. mismatch de genre) peuvent plafonner le jugement à UNDECIDED ou NOT_SAME, indépendamment du score global.

### Comparateurs de chaînes pour les noms français

Les noms français nécessitent des algorithmes spécialisés :

- **Jaro-Winkler** : bonus de préfixe, efficace pour les variantes typographiques
- **Damerau-Levenshtein** : distance d'édition avec transpositions (erreurs OCR courantes)
- **Monge-Elkan** : alignement multi-tokens, gère les noms composés ("Jean-Pierre Dupont" vs "Dupont Jean Pierre")
- **Encodeur phonétique français** : voyelles nasales, ambiguïté b/v, consonnes finales muettes (règle CaReFuL), digraphes

### Résultats du benchmark

Le moteur est validé contre un corpus de **217 paires de politiciens français réels** couvrant 9 catégories de difficulté : correspondances exactes, désambiguïsation par date de naissance, noms communs, variantes phonétiques, erreurs typographiques, dynasties politiques, noms composés, noms de mariage et vrais négatifs.

| Combineur      | Précision | Rappel | F1    |
| -------------- | --------- | ------ | ----- |
| Legacy         | 100%      | 36.8%  | 53.8% |
| Fellegi-Sunter | 100%      | 76.8%  | 86.9% |

Le combineur Fellegi-Sunter double le rappel tout en maintenant 100% de précision (zéro faux positifs).

## Le poligraphId et l'API de réconciliation

Chaque politicien reçoit un identifiant public stable : de `PG-000001` à `PG-036419` (et ça augmente). Contrairement aux slugs (qui peuvent changer lors de corrections de noms) ou aux IDs de base de données (qui sont internes), le poligraphId est conçu pour un usage externe.

Nous avons aussi implémenté l'API W3C Reconciliation Service, permettant aux outils externes de matcher leurs jeux de données avec Poligraph :

```
GET /api/reconcile?queries={"q0":{"query":"Marine Le Pen"}}
```

Cela permet :

- **Intégration OpenRefine.** Les datajournalistes peuvent réconcilier leurs tableurs avec notre base de politiques.
- **Interop Wikidata.** Notre Wikibot peut utiliser le point de réconciliation pour découvrir de nouveaux liens.
- **Intégrations partenaires.** D'autres projets civic tech peuvent vérifier l'identité des politiques par rapport à nos données.

## Cas limite : les doubles noms de famille entre sources de données

La normalisation des noms (suppression des accents, mise en minuscules) corrige la plupart des variations orthographiques. Mais certaines divergences sont structurelles.

La maire de Vincennes est enregistrée dans le RNE sous le nom "Charlotte Libert Albanel" (double nom de famille). Dans le CSV des candidatures municipales 2026 sur data.gouv.fr, la même personne apparaît comme "Charlotte LIBERT" (nom simple, tel qu'imprimé sur le bulletin de vote). L'enrichissement par date de naissance RNE construit une clé de recherche à partir du nom complet normalisé :

```
charlotte|libert albanel|94
```

La recherche côté candidature cherche :

```
charlotte|libert|94
```

Pas de correspondance. Sans l'enrichissement par date de naissance, le resolver d'identité a moins de signal, et la candidate reste non liée à sa fiche politicien.

Le correctif : pour les noms de famille à plusieurs mots, indexer aussi par le nom de famille primaire (premier mot). "Libert Albanel" produit une clé de repli sur "libert", que la recherche côté candidature trouve. Pour éviter les faux positifs, deux garde-fous :

- **Les particules courtes sont ignorées.** "De La Fontaine" ne produit pas de repli sur "de" (2 caractères ou moins). Idem pour "Le Pen", "Du Bois", etc.
- **Détection d'ambiguïté.** Si deux élus différents produiraient la même clé de repli dans le même département (par exemple une "Charlotte Libert" et une "Charlotte Libert Albanel" toutes deux dans le 94), le repli est supprimé pour les deux. Seuls les raccourcis non ambigus sont conservés.

Ce schéma (noms composés dans une source, noms simples dans l'autre) est courant dans les données administratives françaises. Le RNE utilise le nom légal complet issu de l'acte de naissance. Les listes électorales utilisent le nom de bulletin, souvent plus court. Nom marital versus nom de naissance est une autre variante fréquente.

## Leçons apprises

**1. Les faux positifs sont pires que les faux négatifs dans les données civiques.**

Attribuer une condamnation à la mauvaise personne a des conséquences juridiques et de réputation. Ne pas trouver de correspondance signifie simplement des données incomplètes. On a conçu le système pour être conservateur : dans le doute, ne pas matcher.

**2. Le matching déterministe couvre 80%+. Il faut investir là d'abord.**

La plupart de nos politiques viennent de sources institutionnelles avec des identifiants propres (AN, Sénat, HATVP). Les cas difficiles (maires RNE, décisions de justice, articles de presse) sont minoritaires. Construire un traitement robuste pour les 80% faciles avant d'attaquer les 20% flous était la bonne séquence.

**3. Stocker les décisions négatives. Elles ont autant de valeur que les positives.**

La décision NOT_SAME est sans doute la fonctionnalité la plus importante. Sans elle, chaque sync pouvait recréer le bug Thierry Cousin. Avec elle, une seule intervention manuelle bloque définitivement les mauvais matchings.

**4. Tous les noms ne se valent pas.**

Traiter "Martin" et "Mélenchon" de la même façon dans un score de matching est fondamentalement incorrect. La pondération par fréquence de nom a été la plus grande amélioration de notre rappel. Un match sur un nom rare est une évidence forte ; un match sur un nom commun a besoin de corroboration par d'autres signaux.

**5. La normalisation des noms est nécessaire mais pas suffisante.**

La suppression des accents et la mise en minuscules résolvent les variations orthographiques de surface. Mais les différences structurelles entre sources de données (doubles noms, noms de bulletin vs. noms légaux, noms de jeune fille vs. noms maritaux) nécessitent un traitement dédié. Chaque nouvelle source de données apporte ses propres conventions de nommage, et on continue de découvrir des cas limites.

**6. Livrer par phases, valider avant de basculer.**

Nous avons déployé le combineur Fellegi-Sunter en mode shadow d'abord : le scoring legacy continuait à prendre toutes les décisions pendant que les résultats F-S étaient stockés dans l'evidence pour analyse. Un script d'impact analysis a re-scoré les 506 décisions SAME existantes avec le nouveau combineur. Ce n'est qu'après avoir confirmé un accord à 100% que nous avons basculé. Ce chemin de migration sans risque vaut l'effort d'ingénierie supplémentaire.

## La suite

Le moteur de résolution d'identité v2 est en production avec le combineur Fellegi-Sunter qui gère toutes les décisions de matching pour 10+ sources de données.

- **Brancher les signaux temporel et parti** : ces signaux existent mais attendent les données de mandat/parti dans l'input du resolver. Une fois connectés, ils amélioreront la désambiguïsation pour les politiciens homonymes ayant servi à des époques ou dans des partis différents.
- **Sync bidirectionnel Wikidata** : publier les poligraphIds comme identifiants externes Wikidata, bouclant la boucle d'interopérabilité.
- **Interface admin de revue** : un tableau de bord pour la file d'attente des décisions UNDECIDED, permettant aux modérateurs de confirmer ou rejeter les matchings avec une visibilité complète sur les signaux.

L'objectif est un système où chaque politicien dans Poligraph a une chaîne claire et auditable depuis les données sources jusqu'au profil, et où des erreurs comme celle de Thierry Cousin sont détectées avant d'arriver en production.

---

_Poligraph est un observatoire civique open-source qui suit les politiques français. Le code est disponible sur [GitHub](https://github.com/ironlam/poligraph)._
