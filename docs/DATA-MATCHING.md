# Croisement de données et matching

> **Dernière mise à jour** : 2026-03-08

Comment Poligraph réconcilie les données de 14+ sources pour construire une fiche unique par politicien. Ce document décrit les identifiants, les stratégies de matching et les bonnes pratiques pour ajouter une nouvelle source.

---

## Table des matières

- [Principe général](#1-principe-général)
- [Carte des identifiants](#2-carte-des-identifiants)
- [Stratégies de matching](#3-stratégies-de-matching)
- [Identity Resolution Engine](#4-identity-resolution-engine)
- [Croisement Wikidata](#5-croisement-wikidata)
- [Cas concrets](#6-cas-concrets)
- [Ajouter une nouvelle source](#7-ajouter-une-nouvelle-source)
- [Pièges connus](#8-pièges-connus)
- [Rattachement scrutin ↔ débat](#9-rattachement-scrutin--débat)

---

## 1. Principe général

Chaque politicien possède un `id` interne (CUID), un `poligraphId` public (`PG-XXXXXX`) et zéro ou plusieurs `ExternalId` qui le relient aux sources externes :

```
Politician (id: cuid, poligraphId: PG-000542)
  ├── ExternalId(ASSEMBLEE_NATIONALE, "PA841729")
  ├── ExternalId(SENAT, "21077")
  ├── ExternalId(WIKIDATA, "Q3052772")
  ├── ExternalId(HATVP, "macronaaaemmanuel5835")
  ├── ExternalId(PARLEMENT_EUROPEEN, "97236")
  ├── ExternalId(NOSDEPUTES, "jean-luc-melenchon")
  └── ExternalId(RNE, "...")
```

Le modèle `ExternalId` a une contrainte unique sur `(source, externalId)`. Un politicien peut avoir plusieurs IDs de la même source (ex : mandat député + mandat sénateur).

**Workflow d'import standard** : `batchResolve()` centralise tout le matching. Il consulte les décisions antérieures, puis les identifiants externes, puis les critères biographiques. Voir [section 4](#4-identity-resolution-engine).

---

## 2. Carte des identifiants

### Identifiants par source

| Source              | Champ source     | Format              | Exemple                 | ExternalId.source     | Wikidata P-ID |
| ------------------- | ---------------- | ------------------- | ----------------------- | --------------------- | ------------- |
| Assemblée nationale | ID CSV           | `PA` + chiffres     | `PA841729`              | `ASSEMBLEE_NATIONALE` | P4123         |
| Sénat               | matricule        | chiffres + lettre   | `21077M`                | `SENAT`               | P4324         |
| HATVP               | classement (CSV) | `nomaaaprenom12345` | `macronaaaemmanuel5835` | `HATVP`               | P4703         |
| Parlement européen  | identifier (API) | chiffres            | `97236`                 | `PARLEMENT_EUROPEEN`  | -             |
| Wikidata            | Q-ID             | `Q` + chiffres      | `Q3052772`              | `WIKIDATA`            | -             |
| NosDéputés          | slug             | prénom-nom          | `jean-luc-melenchon`    | `NOSDEPUTES`          | P7384         |
| RNE                 | -                | -                   | -                       | `RNE`                 | -             |

### URLs de résolution

Chaque identifiant permet de construire l'URL vers la fiche d'origine :

| Source              | Pattern URL                                                     |
| ------------------- | --------------------------------------------------------------- |
| Assemblée nationale | `https://www.assemblee-nationale.fr/dyn/deputes/{id}`           |
| Sénat               | `https://www.senat.fr/senateur/{matricule}.html`                |
| HATVP               | `https://www.hatvp.fr/fiche-nominative/?declarant={classement}` |
| Parlement européen  | `https://www.europarl.europa.eu/meps/fr/{id}`                   |
| Wikidata            | `https://www.wikidata.org/wiki/{qid}`                           |
| NosDéputés          | `https://www.nosdeputes.fr/{slug}`                              |

---

## 3. Stratégies de matching

### Stratégie 1 : Matching par identifiant externe (fiable)

Quand la source fournit un identifiant connu (AN, Sénat), on cherche directement dans `ExternalId` :

```
Source → id_origine → ExternalId.findFirst({ source, externalId }) → politicianId
```

**Utilisé par** : HATVP (via `id_origine` pour députés/sénateurs), votes AN/Sénat, législation.

**Fiabilité** : 100%, un ID est un ID.

### Stratégie 2 : Matching par nom (fallback)

Quand il n'y a pas d'identifiant, on matche par nom (prénom + nom, case-insensitive) :

```
Source → (prénom, nom) → Politician.findFirst({ firstName, lastName, mode: insensitive }) → id
```

**Utilisé par** : HATVP (pour gouvernement, président, communes), presse, fact-checks.

**Fiabilité** : ~95%, risque d'homonymes.

**Améliorations** :

- Normalisation des accents (`Éléonore` vs `Eleonore`)
- Particules (`Le Pen` vs `LE PEN`)
- Thésaurus de prénoms (`src/lib/french-names.ts`) : `Jean-Luc` ↔ `Jean Luc`

### Stratégie 3 : Matching par nom + date de naissance (anti-homonymes)

Pour les sources à risque d'homonymes (Wikidata, RNE), on croise nom + date de naissance :

```
Source → (nom, dateNaissance) → Politician.findFirst({
  lastName: nom,
  birthDate: { gte: date - 5j, lte: date + 5j }
})
```

**Utilisé par** : Wikidata IDs, RNE maires.

**Fiabilité** : ~99.9%, quasi impossible d'avoir deux homonymes nés le même jour.

### Stratégie 4 : Matching par nom + département (géographique)

Pour les élus locaux, le département réduit les homonymes :

```
Source → (nom, département) → Politician + Mandate.findFirst({
  lastName: nom,
  mandates: { departmentCode: dept }
})
```

**Utilisé par** : Candidatures municipales, RNE.

**Fiabilité** : ~98%.

---

## 4. Identity Resolution Engine

Depuis mars 2026, tout le matching cross-source est centralisé dans `batchResolve()` (`src/lib/identity/`).

### Pipeline en 7 étapes

1. **Décisions antérieures** : consulte `IdentityDecision` pour les matchs déjà validés (SAME) ou invalidés (NOT_SAME)
2. **Matching déterministe** : identifiant externe partagé = confiance 1.0
3. **Date de naissance** : nom + date de naissance = confiance 0.9
4. **Département** : nom + mandat dans le même département = confiance 0.7
5. **Nom seul** : confiance 0.5 (insuffisante pour un match auto)
6. **Seuils** : >= 0.95 auto-lié, 0.70-0.94 file d'attente humaine, < 0.70 rejeté
7. **Journalisation** : chaque décision enregistrée dans `IdentityDecision`

### Blocklist de mentions

Pour la presse et les fact-checks, `findMentions()` utilise du matching textuel (regex). Les décisions NOT_SAME servent de blocklist pour éviter les faux positifs récurrents sur les noms courants (Philippe, Laurent, etc.).

### Usage

```typescript
import { batchResolve } from "@/lib/identity";
const results = await batchResolve(candidates, { source: DataSource.RNE });
```

**Règle** : seul `Judgement.SAME` (>= 0.95) doit être auto-lié. `UNDECIDED` (0.70-0.94) nécessite une revue manuelle via l'admin.

---

## 5. Croisement Wikidata

Wikidata est le **hub de croisement** central. Chaque politicien avec un Q-ID peut être relié à toutes les autres sources via les propriétés Wikidata :

```
Wikidata Q3052772 (Emmanuel Macron)
  ├── P4123 → ID Assemblée nationale
  ├── P4324 → ID Sénat
  ├── P4703 → ID HATVP (classement)
  ├── P7384 → Slug NosDéputés
  ├── P569  → Date de naissance (vérification)
  ├── P18   → Photo Wikimedia Commons
  ├── P39   → Positions occupées (carrière)
  ├── P102  → Parti politique
  └── P1399 → Condamnations
```

### Configuration centralisée

Toutes les propriétés Wikidata sont dans `src/config/wikidata.ts` (`WD_PROPS`). Ne jamais utiliser un P-ID en dur dans le code, toujours passer par cette config.

### Matching Wikidata → Politicien

Le script `sync:wikidata-ids` :

1. Cherche par nom sur l'API REST Wikidata (`wbsearchentities`)
2. Récupère les claims du candidat (`wbgetclaims`)
3. Vérifie la date de naissance (P569) à +-5 jours
4. Stocke le Q-ID comme `ExternalId(WIKIDATA, qid)`

---

## 6. Cas concrets

### HATVP : trois niveaux de matching

Le sync HATVP illustre la cascade complète :

1. **Députés** : `id_origine` (ex : `841729`) → cherche `ExternalId(ASSEMBLEE_NATIONALE, "PA841729")`
2. **Sénateurs** : `id_origine` (ex : `21077M`) → cherche `ExternalId(SENAT, "21077")`
3. **Gouvernement/Président/Communes** : `id_origine` vide → fallback nom

Le champ `classement` est ensuite stocké comme `ExternalId(HATVP, classement)`, permettant le croisement avec Wikidata P4703.

### Types de mandats HATVP importés

| `type_mandat` CSV | Importé | Raison                                           |
| ----------------- | ------- | ------------------------------------------------ |
| `depute`          | Oui     | Nos politiciens                                  |
| `senateur`        | Oui     | Nos politiciens                                  |
| `gouvernement`    | Oui     | Nos politiciens                                  |
| `europe`          | Oui     | Eurodéputés                                      |
| `president`       | Oui     | Président(s)                                     |
| `commune`         | Oui     | Maires (matching par nom)                        |
| `departement`     | Non     | Pas encore de conseillers départementaux en base |
| `region`          | Non     | Pas encore de conseillers régionaux en base      |
| `epci`            | Non     | Intercommunalités                                |
| `ctsp`            | Non     | Collectivités à statut particulier               |
| `autre`           | Non     | Divers                                           |

### Presse : matching prudent

La presse utilise le matching par nom dans le titre/description de l'article. Pour éviter les faux positifs :

- Noms courts (< 4 lettres) : match mot entier uniquement
- Thésaurus de prénoms pour les variantes
- Blocklist via décisions NOT_SAME pour les noms courants (voir section 4)

---

## 7. Ajouter une nouvelle source

Checklist pour intégrer une nouvelle source de données :

### 1. Identifier les identifiants disponibles

- La source fournit-elle un ID unique par personne ?
- Cet ID existe-t-il sur Wikidata (propriété P-xxx) ?
- Si oui, ajouter le P-ID dans `src/config/wikidata.ts` (`WD_PROPS`)

### 2. Choisir la stratégie de matching

| Situation                                       | Stratégie                                                    |
| ----------------------------------------------- | ------------------------------------------------------------ |
| La source a un ID qu'on a déjà (ex : ID AN)     | Matching par ExternalId existant                             |
| La source a un nouvel ID croisable via Wikidata | Matching par Q-ID → P-xxx                                    |
| La source n'a pas d'ID                          | Matching par nom (+ date de naissance si risque d'homonymes) |

**Recommandé** : utiliser `batchResolve()` pour tout import de données politiques.

### 3. Stocker l'ExternalId

Si la source a un identifiant unique :

1. Ajouter la source dans l'enum `DataSource` (`prisma/schema.prisma`)
2. `prisma db push` pour appliquer
3. Dans le sync, appeler `db.externalId.upsert()` après le matching

### 4. Documenter

- Ajouter la source dans `docs/DATASOURCES.md`
- Ajouter les identifiants dans ce document (section 2)
- Mettre à jour `src/config/wikidata.ts` si pertinent

---

## 8. Pièges connus

### Accents et normalisation

Les noms dans les sources officielles varient : `Éléonore` vs `Eleonore` vs `ELEONORE`. Le matching case-insensitive de Prisma (`mode: "insensitive"`) gère la casse mais **pas les accents manquants**.

**Solution** : le thésaurus de prénoms (`src/lib/french-names.ts`) inclut les variantes avec/sans accents.

### Homonymes

Risque réel pour les noms courants (Martin, Durand). Le matching par nom seul ne suffit pas.

**Solution** : croiser avec la date de naissance (+-5 jours) ou le département. Utiliser `batchResolve()` qui gère la cascade automatiquement.

### Noms courants = faux positifs textuels

Les politiciens avec des noms = prénoms courants (Philippe, Laurent, Jacques) ou mots communs (Placé, Bataille, Mesure) génèrent des faux positifs massifs dans le matching presse/factchecks.

**Solution** : blocklist via décisions NOT_SAME dans `IdentityDecision`, chargée au démarrage du sync via `loadMentionBlocklist()`.

### IDs qui changent

Certaines sources changent les IDs entre législatures (ex : ID AN `PA*` change d'une législature à l'autre).

**Solution** : stocker l'ID + la source, accepter plusieurs ExternalIds par politicien pour la même source.

### Double création

Si le matching échoue (nom mal normalisé, accent différent), le sync peut créer un doublon.

**Solution** : ne jamais créer de politicien dans un sync d'enrichissement (HATVP, RNE, presse). Seuls les syncs institutionnels (AN, Sénat, Gouvernement) créent.

### Champs vides dans le CSV HATVP

Le champ `id_origine` est vide pour certains types de mandats (gouvernement, président, commune). C'est normal, le fallback par nom prend le relais.

---

## 9. Rattachement scrutin ↔ débat

Le but : relier un scrutin (`Scrutin`) au bon extrait de compte rendu de séance
(`DebateTranscript`), de façon **déterministe et auditable**, sans LLM. Ce
rattachement conditionne la génération de `ScrutinAnalysis` (arguments POUR/CONTRE
issus du débat). Il n'est volontairement **pas** branché sur la génération tant que
l'audit ne prouve pas une qualité suffisante.

### Pourquoi le lien historique est fragile

`syncDebateTranscripts()` stocke **un transcript par séance** (clé `seanceRef`),
tronqué à 5000 caractères, puis l'attache au **premier scrutin du jour sans débat**
(`debate-transcripts.ts`, lien par date seule). Sur un jour à 100+ scrutins, la
quasi-totalité reste sans débat et le rare scrutin lié peut l'être au mauvais.

### Le matcher déterministe

Pipeline pur, sans I/O ni modèle (`src/services/scrutin-substance/`) :

1. `findAmendmentMention(text, refs)` (`debate-context.ts`) cherche dans le texte
   une mention forte de l'amendement voté :
   - `HIGH` : numéro d'amendement cité explicitement (« l'amendement no 2084 »).
   - `MEDIUM` : auteur + article à proximité, sans numéro.
   - `LOW` : auteur ou article seul. `NONE` : rien.
   - `reinforced` : diagnostic, numéro **et** auteur/article proches (non requis).
2. `resolveDebateContextForScrutin(id)` (`debate-context-resolver.ts`) rassemble
   les transcripts **du même jour** (il ignore le lien `scrutinId` cassé), applique
   le matcher, garde le meilleur. Ce sont des transcripts **same-day**, récupérés
   par date seule : un transcript same-day n'est **pas** un rattachement prouvé. Le
   resolver expose `candidateTranscriptCount` (> 1 = jour ambigu) et
   `transcriptsMentioningAmendment` (= 1 = débat localisable à une seule séance).

   Seul `HIGH` (numéro d'amendement cité) est une référence explicite suffisante. Un
   article seul ne suffit pas : le cas 2084 mentionne l'article 22 mais jamais
   l'amendement 2084, il reste donc `unsafe`.

3. `classifyDebateMatch(...)` (`debate-mapping.ts`) rend un verdict strict :

   | Classe      | Règle                                                         | Génération  |
   | ----------- | ------------------------------------------------------------- | ----------- |
   | `matched`   | `HIGH` **et** un seul transcript candidat le jour             | exploitable |
   | `ambiguous` | `HIGH` multi-séances le même jour, **ou** `MEDIUM`            | skip        |
   | `unsafe`    | transcript présent mais `LOW`/`NONE` (objet voté jamais cité) | skip        |
   | `missing`   | aucun transcript candidat                                     | skip        |

### Le script d'audit (read-only)

```bash
npx dotenv -e .env -- npx tsx scripts/audit-scrutin-debate-mapping.ts
```

Portée : key votes liés à un amendement (seul périmètre où le matcher par numéro
prouve un lien). Sortie : périmètre, métriques par classe, exemples bons/ambigus/
mauvais, et le cas sentinelle `VTANR5L17V7183` / amendement 2084 (qui doit rester
`unsafe`). Aucune écriture, aucun appel modèle, aucun backfill.

### Limite structurelle connue

L'AN siège en 2-3 séances par jour, chacune étant un `DebateTranscript` distinct.
Sous la règle stricte, tout numéro cité tombe donc sur un jour multi-transcripts et
finit `ambiguous` : `matched` est quasi inatteignable.

La métrique `uniquelyLocalizable` (numéro présent dans **une seule** séance du jour)
est un **potentiel, pas une promesse** : elle dit « ces cas semblent localisables de
façon unique », et non « autant d'analyses générables ». Un scoping **par séance**
(et non par jour) côté ingestion pourrait les promouvoir en `matched` ; ils
resteraient ensuite soumis aux garde-fous de génération. C'est le prérequis avant
tout branchement sur `ScrutinAnalysis`.
