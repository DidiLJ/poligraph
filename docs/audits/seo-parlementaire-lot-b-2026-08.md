# SEO parlementaire — Lot B (proposition, non implémenté)

Note de suite du Lot A (SEO des surfaces parlementaires existantes). Rien de ce
qui suit n'est implémenté : ce document sert de cadrage pour un chantier
ultérieur. Le principe directeur reste inchangé — faire ranker des surfaces
riches correspondant à des intentions de recherche réelles, pas indexer
davantage de scrutins bruts.

## B1. Enrichissement des pages thématiques

1. **Dossiers législatifs associés** : lister sur `/parlement/votes/themes/[theme]`
   les dossiers dont les scrutins portent ce thème. Lien déterministe existant
   (`Scrutin.dossierLegislatif`), aucune agrégation nouvelle, et maillage
   direct vers `/parlement/dossiers/[slug]`.
2. **Votes expliqués du thème** : réutiliser le périmètre `filter=expliques`
   (titres explicatifs APPROVED) restreint au thème. Contenu déjà validé
   éditorialement, donc publiable sans nouvelle politique.
3. **Derniers scrutins du thème** : déjà présents via la liste paginée ; à
   évaluer surtout comme bloc « activité récente » en tête de page.
4. **Thèmes voisins** : uniquement si une taxonomie explicite est introduite en
   base. Aucune proximité ne doit être inférée statistiquement.

## B2. Pages de votes des élus

5. **Volume et dernier vote connu** : nombre de votes enregistrés (déjà affiché)
   et date du dernier vote, tous deux déterministes. Aucun taux, aucune
   participation (cf. #717).
6. **Répartition par type de scrutin** : les compteurs d'onglets existent déjà
   (`getPoliticianVoteTabCounts`) ; une répartition lisible ne coûte pas de
   requête supplémentaire.
7. **Votes marquants** : uniquement sur un critère existant et documenté
   (`ScrutinImportance.isKeyVote`). Jamais de sélection éditoriale implicite,
   jamais d'interprétation du comportement de vote.

## B3. Jeu de données parlementaire

8. **Page `/donnees/parlement`** : contenu du jeu de données, provenance
   (data.assemblee-nationale.fr, senat.fr), couverture (législatures, chambres,
   types de scrutins), fréquence de mise à jour, limites connues, liens vers les
   sources officielles et vers l'API/exports publics.
9. **JSON-LD `Dataset`** : pertinent pour cette page uniquement (éligible à
   Google Dataset Search), avec `DataCatalog` seulement si plusieurs jeux de
   données distincts sont décrits. À ne pas poser sur les listings existants.
10. **Pré-requis** : la page ne doit décrire que la couverture réellement
    servie ; toute limite non documentée doit être écrite plutôt que passée sous
    silence.

## Hors scope explicite (rappel)

- Aucune archive combinatoire (thème × élu × groupe), aucune indexation de
  facettes, aucune modification de la politique de sitemap des scrutins.
- Aucune FAQ artificielle, aucun `FAQPage` JSON-LD, aucun texte éditorial
  généré automatiquement.
- Les règles globales d'indexabilité des fiches `/parlement/votes/[slug]`
  demandent une analyse Search Console dédiée avant toute modification.
