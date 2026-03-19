# Contribuer à Poligraph

Merci de votre intérêt pour Poligraph ! Ce guide explique comment contribuer au projet.

## Avant de commencer

- **Vérifier les issues existantes** : quelqu'un travaille peut-être déjà sur le même sujet. Consultez les [issues ouvertes](https://github.com/ironlam/poligraph/issues) et les [PRs en cours](https://github.com/ironlam/poligraph/pulls).
- **Nouvelle fonctionnalité** : ouvrez d'abord une [issue](https://github.com/ironlam/poligraph/issues/new?template=feature_request.md) pour en discuter. Cela évite de coder quelque chose qui ne sera pas mergé.
- **Bug ou documentation** : vous pouvez soumettre une PR directement.
- **Première contribution ?** Cherchez les issues avec le label [`good first issue`](https://github.com/ironlam/poligraph/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). Elles sont conçues pour découvrir le projet sans pré-requis particulier.

## Démarrage rapide (< 5 minutes)

### Prérequis

- [Node.js 22+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) (recommandé) **ou** une instance PostgreSQL

### Installation automatique

```bash
# 1. Forker et cloner le repo
git clone https://github.com/<votre-username>/poligraph.git
cd poligraph

# 2. Tout installer d'un coup (Docker, deps, DB, fixtures)
npm run setup
```

Le script `setup` :

- Installe les dépendances npm
- Crée `.env` avec PostgreSQL local pré-configuré
- Démarre PostgreSQL via Docker Compose
- Génère le client Prisma et pousse le schéma
- Charge des données fictives réalistes (politiciens, votes, affaires...)

```bash
# 3. Lancer le serveur de développement
npm run dev
# → http://localhost:3000
```

### Installation manuelle (sans Docker)

```bash
git clone https://github.com/<votre-username>/poligraph.git
cd poligraph
npm install
cp .env.example .env
# Éditer .env avec votre URL PostgreSQL
npm run db:generate
npm run db:push
npm run seed:fixtures --force
npm run dev
```

### Variables d'environnement

Le fichier `.env.example` est organisé en 3 sections :

| Section      | Nécessaire pour...                     |
| ------------ | -------------------------------------- |
| **REQUIRED** | Faire tourner l'app (DB + URL + admin) |
| **OPTIONAL** | IA, analytics, social posting          |
| **ADVANCED** | Scripts de synchronisation spécifiques |

Pour contribuer au frontend ou aux composants, seule la section **REQUIRED** est nécessaire.

## Workflow de contribution

Le projet utilise le modèle **Fork & Pull**, standard en open source. Vous n'avez pas besoin d'accès en écriture au repo principal.

### 1. Forker et préparer

```bash
# Forker le repo sur GitHub (bouton "Fork" en haut à droite)
# Puis cloner votre fork
git clone https://github.com/<votre-username>/poligraph.git
cd poligraph

# Ajouter le repo principal comme remote "upstream"
git remote add upstream https://github.com/ironlam/poligraph.git
```

### 2. Créer une branche

```bash
# Toujours partir de main à jour
git fetch upstream
git checkout -b feat/ma-fonctionnalite upstream/main
```

### 3. Coder et vérifier

```bash
# Le pre-commit hook lance lint + format automatiquement
# Vérifier manuellement avant de pousser :
npm run lint && npm run typecheck && npm run test:run
```

### 4. Pousser et ouvrir une PR

```bash
git push origin feat/ma-fonctionnalite
```

Ouvrez une Pull Request depuis votre fork vers `ironlam/poligraph:main`. Remplissez le template fourni.

### 5. Review et merge

Un maintainer reviewera votre PR. Soyez patient, le projet est maintenu bénévolement. Vous pouvez recevoir des demandes de modifications : c'est normal et constructif. Une fois approuvée, votre PR sera mergée (squash merge).

## Guidelines pour les Pull Requests

- **Une PR = un sujet.** Ne mélangez pas un bug fix et une feature dans la même PR.
- **Taille raisonnable** : visez moins de 400 lignes modifiées. Au-delà, découpez en plusieurs PRs.
- **Liez à une issue** : utilisez `Closes #123` dans la description pour lier automatiquement.
- **Décrivez le pourquoi**, pas seulement le quoi. Le diff montre ce qui change, la description explique pourquoi.
- **Tests** : toute nouvelle fonctionnalité (service, data function, utilitaire) doit inclure des tests.
- **CI verte** : les 4 jobs (lint, typecheck, format-check, unit-tests) doivent passer avant review.

## Conventions de commits

Utiliser le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajouter le filtre par département
fix: corriger le calcul des mandats actifs
docs: mettre à jour DATASOURCES.md
refactor: simplifier le service de sync
```

Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

## Conventions de code

- **Composants React** : `PascalCase.tsx`
- **Utilitaires** : `camelCase.ts`
- **Routes API** : `kebab-case`
- **Langue du code** : anglais
- **Langue de l'interface** : français
- Toujours `npm run lint` avant de committer (le pre-commit hook le fait automatiquement)
- `npm run build` doit passer sans erreur

## Convention de nommage

**Principe : le francais pour le domaine, l'anglais pour le code.**

Ce projet suit la politique francaise. Les termes specifiques au domaine utilisent leur forme francaise canonique. Les patterns de programmation utilisent l'anglais.

| Quoi                      | Langue                             | Exemple                                          |
| ------------------------- | ---------------------------------- | ------------------------------------------------ |
| Noms de domaine           | Francais                           | `depute`, `maire`, `scrutin`, `affaire`, `parti` |
| Verbes de programmation   | Anglais                            | `sync*`, `get*`, `fetch*`, `create*`             |
| Noms composes             | Verbe anglais + nom francais       | `syncDeputes()`, `getMaires()`                   |
| Valeurs d'enum Prisma     | Francais SCREAMING_SNAKE_CASE      | `DEPUTE`, `MAIRE`, `FONDATEUR`                   |
| Types de modele Prisma    | Geles tels quels                   | `Politician`, `PartyRole`                        |
| Chemins URL               | Geles tels quels                   | Ne pas renommer les routes existantes            |
| Noms de fichiers          | Noms de domaine francais           | `deputes.ts`, `scrutins.ts`                      |
| Scripts npm               | Noms de domaine francais           | `sync:scrutins-an`, `maires:promote`             |
| Composants React          | PascalCase anglais + noms francais | `MissingMairesTable`                             |
| Repertoires de composants | Noms de domaine francais           | `components/partis/`                             |

### Glossaire

| Terme francais (utiliser dans le code) | Equivalent anglais     | Contexte                                                                                           |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `depute`                               | deputy / MP            | Membre de l'Assemblee Nationale                                                                    |
| `senateur`                             | senator                | Membre du Senat                                                                                    |
| `maire`                                | mayor                  | Chef d'une commune                                                                                 |
| `commune`                              | municipality           | Unite administrative francaise                                                                     |
| `parti`                                | party                  | Parti politique                                                                                    |
| `scrutin`                              | roll-call vote         | Session de vote parlementaire (PAS "vote" - un vote est une position individuelle dans un scrutin) |
| `affaire`                              | judicial affair        | Procedure judiciaire impliquant un politique                                                       |
| `dossier`                              | legislative dossier    | Un texte legislatif et son parcours                                                                |
| `assemblee`                            | national assembly      | Chambre basse (AN)                                                                                 |
| `senat`                                | senate                 | Chambre haute                                                                                      |
| `gouvernement`                         | government             | Branche executive                                                                                  |
| `candidature`                          | candidacy              | Candidature electorale                                                                             |
| `nuance`                               | political leaning code | Classification electorale francaise                                                                |

**Termes empruntes (gardes tels quels dans le code) :** `factcheck`, `election`, `declaration`, `legislation`, `photo`, `press`, `audit`, `newsletter`, `admin`.

### Exemples

```typescript
// Bon : verbe anglais + nom de domaine francais
async function syncDeputes() { ... }
async function getMaires() { ... }
async function getScrutinsByDate() { ... }

// Mauvais : noms de domaine en anglais
async function syncDeputies() { ... }
async function getMayors() { ... }

// Bon : valeurs d'enum francaises
enum PartyRole { MEMBRE, FONDATEUR, PORTE_PAROLE }

// Mauvais : valeurs d'enum anglaises pour un domaine francais
enum PartyRole { MEMBER, FOUNDER, SPOKESPERSON }
```

## Structure du projet

```
src/
├── app/           # Routes (App Router Next.js)
├── components/    # Composants React (ui/, layout/, politicians/, admin/...)
├── config/        # Configuration, constantes, labels i18n
├── lib/           # Utilitaires, clients API, data layer
│   └── data/      #   Fonctions de requête cachées (getPolitician, getAffairs...)
├── services/      # Logique métier (sync, affairs, votes...)
└── types/         # Types TypeScript
scripts/           # Scripts de synchronisation et outils CLI
prisma/            # Schéma Prisma
```

### Zones idéales pour commencer

| Zone                   | Risque | Exemples                                           |
| ---------------------- | ------ | -------------------------------------------------- |
| `src/components/ui/`   | Faible | Nouveaux composants UI, améliorations visuelles    |
| `src/config/labels.ts` | Faible | Traductions, labels manquants                      |
| `tests/`               | Faible | Nouveaux tests unitaires                           |
| `src/components/*/`    | Moyen  | Composants de page (politicians, affairs...)       |
| `src/app/*/page.tsx`   | Moyen  | Pages publiques                                    |
| `src/lib/data/`        | Élevé  | Couche de données (nécessite connaissance caching) |
| `scripts/`             | Élevé  | Scripts de synchronisation (nécessite accès API)   |

## Storybook

Le projet dispose d'un catalogue de composants UI avec [Storybook](https://storybook.js.org/). C'est le meilleur point de depart pour comprendre et modifier les composants visuels.

```bash
npm run storybook        # Lancer Storybook sur http://localhost:6006
npm run storybook:build  # Build statique (CI, deploiement)
```

Les stories se trouvent dans `src/components/ui/*.stories.tsx`. Pour ajouter une story a un nouveau composant :

1. Creer un fichier `MonComposant.stories.tsx` a cote du composant
2. Utiliser des donnees politiques realistes en francais (pas de lorem ipsum)
3. Documenter les variantes principales (tailles, etats, dark mode)

## Commandes utiles

```bash
npm run dev              # Serveur de développement
npm run storybook        # Catalogue de composants (localhost:6006)
npm run lint             # Vérifier le code
npm run typecheck        # Vérifier les types TypeScript
npm run test:run         # Lancer les tests
npm run db:studio        # Explorer la base avec Prisma Studio
npm run format           # Formatter le code (Prettier)
```

## Signaler un bug

Ouvrir une [issue](https://github.com/ironlam/poligraph/issues/new?template=bug_report.md) en décrivant :

- Ce qui se passe
- Ce qui devrait se passer
- Les étapes pour reproduire

## Proposer une fonctionnalité

Ouvrir une [issue](https://github.com/ironlam/poligraph/issues/new?template=feature_request.md) en expliquant :

- Le besoin citoyen
- La solution proposée
- Les alternatives envisagées

## Questions ?

Ouvrez une [Discussion](https://github.com/ironlam/poligraph/discussions) sur GitHub pour toute question sur le projet, l'architecture, ou comment aborder une contribution. Les issues sont réservées aux bugs et demandes de fonctionnalités.

## Principes importants

- **Neutralité partisane** : mêmes critères pour tous les bords politiques
- **Fiabilité** : sources officielles uniquement, ne jamais inventer de données
- **Présomption d'innocence** : obligatoire pour les affaires en cours
- **Accessibilité** : WCAG AA minimum

## Code de conduite

Ce projet suit un [Code de conduite](./CODE_OF_CONDUCT.md). En participant, vous vous engagez à le respecter.

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous la licence [AGPL-3.0](./LICENSE).
