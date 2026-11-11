# Conventions

Règles de code du dépôt. Elles sont opposables : la CI les vérifie.

## Code

- **Un fichier < 500 lignes, une fonction < 50 lignes.** Au-delà, on découpe
  (module, helper, sous-composant) — jamais on ne laisse grossir.
- **Zéro duplication.** Un helper existe une fois : on le cherche avant
  d'écrire. Les fakes sont dans `tests/helpers/`, les messages dans
  `src/i18n/`, les requêtes dans `src/db/`.
- **Le domaine est pur.** `src/domain/` n'importe jamais `@forge/*`, ni
  `node:fs`, ni le réseau. Les entrées/sorties passent par `src/ports.ts`.
- **Typage strict** : pas de `any` implicite, pas de `!` non justifié, pas
  de `@ts-ignore` sans raison écrite en commentaire.
- **Les données absences sont normales** : une ligne manquante rend `null`,
  une liste vide rend `[]`. Jamais d'exception pour « pas encore là ».
- **Rien ne se supprime** : on remplace, on garde l'historique (SPEC §20).

## Nommage

- Dossiers en `kebab-case`, fichiers TypeScript en `camelCase`
  (`criterion-store.ts`), types en `PascalCase`.
- Les constantes de domaine sont en `MAJUSCULES_SOUS_TRAITS`.
- Les clés de message i18n sont en `domaine.point` (`gate.blocked`).

## Tests

- Un test par comportement, nommé d'après le comportement :
  `it('bloque quand un critère n’a aucune preuve')`.
- Les données sensibles au temps utilisent l'horloge injectée, jamais
  `Date.now()`.
- Les tests du domaine n'utilisent **que** les fakes de `tests/helpers/`.
- La recette du SPEC §22 est couverte par `tests/acceptance/recette-XX`.

## Messages

- Toute chaîne visible par l'utilisateur passe par `src/i18n/<lot>.ts`, en
  anglais **et** en français.
- Un message d'erreur nomme le critère et la preuve attendue (SPEC §5,
  principe 5). Jamais « une erreur est survenue ».

## Commits et PR

- Une PR = un lot. Le corps contient la section `## Scope` (liste des chemins
  modifiés) : la garde `couche0` la refuse sinon.
- Le message de commit dit ce qui change, pas « wip ».
- Le merge est fait par la file Mergify, jamais à la main. Le frein manuel est
  l'étiquette `hold`.
- Un changement de contrat (types, ports, manifest) se fait seul, dans une PR
  dédiée, avec `CONTRACT-CHANGE` dans le corps.

## Git

- `main` est protégé : pas de push direct, tout passe par une PR.
- Branches : `lot/<nom>` pour un lot, `fix/<sujet>` pour une correction.
- Aucune dépendance ajoutée sans raison écrite dans le corps de la PR.

## CI

- Un job, verdict en **5 minutes maximum**. On découpe, on ne rallonge jamais
  un timeout (règle CI de fin octobre 2026).
- `timeout-minutes: 5` sur chaque job, `concurrency` par PR, `fetch-depth: 1`.
- Sur runner self-hosted, on garde `node_modules` :
  `git clean -ffdx -e /node_modules`.
