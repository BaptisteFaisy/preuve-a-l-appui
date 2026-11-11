# Méthode — comment le projet est construit

Ce fichier raconte la fabrication : des lots autonomes, un contrat gelé, une
CI qui tranche en cinq minutes et une file de merge automatique. Le « quoi »
est dans le [cahier des charges](CAHIER-DES-CHARGES.md) (le SPEC), le « qui
possède quoi » dans [CONTRACTS.md](CONTRACTS.md).

## 1. Le contrat d'abord, les lots ensuite

Avant toute fonctionnalité, un socle unique pose ce que tout le monde
s'interdit de toucher :

- `src/types.ts` — le vocabulaire du domaine (critère, preuve, force,
  couverture, dérogation) ;
- `src/ports.ts` — les interfaces entre le domaine pur et le runtime Forge ;
- `src/defaults.ts` — la grille d'exigences par défaut (SPEC §9.2) ;
- les sept points d'entrée en souche (`src/handlers/`), le schéma SQL
  (`src/db/schema.ts`), le manifest, les fakes de test partagés
  (`tests/helpers/`, dont le scénario PAY-123 du SPEC §7).

Ensuite le travail est découpé en **dix lots** (L0 socle, L1 critères,
L2 preuves, L3 couverture, L4 CI, L5 MCP & Rovo, L6 écrans, L7 rapprochement
& rapports, L8 docs & démo, L9 adaptateurs). Chaque lot possède ses fichiers,
ses tests et son fichier de messages `src/i18n/<lot>.ts` ; un lot n'écrit
jamais dans le dossier d'un autre. La carte complète est dans
[CONTRACTS.md](CONTRACTS.md) §2.

Un besoin de changer un type, un port ou le manifest ? On ne le fait pas dans
son coin : une PR dédiée, fichier par fichier, avec la mention
`CONTRACT-CHANGE` dans le corps.

## 2. Une PR = un lot, un périmètre déclaré

Chaque PR liste ses fichiers sous la section `## Scope` de son corps. La
garde `couche0` la compare au diff réel : un fichier modifié non déclaré, ou
déclaré mais inutilisé, et la PR est refusée. Elle bannit aussi les motifs
dangereux dans les lignes ajoutées (poussée forcée sans lease, écrasement
unilatéral de merge, déclencheur à privilèges, clé secrète, dates d'octobre
2026 sous forme interdite).

Les règles de code sont les mêmes partout (voir
[CONVENTIONS.md](CONVENTIONS.md)) : fichier < 500 lignes, fonction < 50
lignes, zéro duplication, domaine pur (`src/domain/` n'importe jamais
`@forge/*`), toute chaîne visible en anglais **et** en français, horloge
injectée dans les tests.

## 3. La CI tranche en cinq minutes

Un seul check requis, `ci`, sur runner self-hosted, avec un budget infranchissable
de cinq minutes par job (règle CI de fin octobre 2026 — garde `ci-budget`) :

1. `npx tsc --noEmit` — aucun type faux ;
2. `npx vitest run` — aucun test rouge ;
3. gardes de taille (fichier, fonction) ;
4. garde du manifest Forge ;
5. sanity docs — tout document est UTF-8 et non vide ;
6. les gardes CI se testent elles-mêmes.

Le détail des checks est dans [CI.md](CI.md). Pas de build natif ni d'E2E dans
la PR : hors budget, hors PR.

## 4. La file Mergify merge seule

`main` est protégé : personne ne merge à la main. Une PR verte (checks requis
au vert, conflits absents, scope déclaré) entre dans la file Mergify
(`.mergify.yml`) et fusionne à son tour, stricto sensu dans l'ordre d'arrivée.
Le frein manuel est l'étiquette `hold`. Conséquence : les lots avancent en
parallèle sans que personne joue au contrôleur aérien.

## 5. Les agents et la gestion de conflit

Chaque lot est développé par un agent qui travaille dans son worktree, sur sa
branche `lot/<nom>`, sans jamais pousser sur `main`. Quand la base bouge sous
une PR, un agent de conflit la remet à jour (rebase ou merge de `main`, au
cas par cas, sans écraser le travail des autres : les poussées forcées ne
sont tolérées qu'avec `--force-with-lease`). Les gardes `stale-base-guard` et
`pr-auto-merge` surveillent la file : une PR dont la base a trop vieilli est
signalée, une file cassée est mise en pause plutôt que vidée.

## 6. Le jeu de démo comme source unique des chiffres

Tout ce qui est chiffré dans la documentation vient du jeu de démo
[`src/sample/pay-123.ts`](../src/sample/pay-123.ts) (PAY-123 : 4 critères,
2 preuves machine, 1 attestation attendue, 1 sans preuve — couverture 2 / 4)
et est verrouillé par [`tests/sample/pay-123.test.ts`](../tests/sample/pay-123.test.ts).
Aucun nombre n'est écrit à la main dans un document : les docs citent le jeu,
les tests comparent les docs au jeu. Détail dans [DEMO-DATA.md](DEMO-DATA.md).

## 7. Le calendrier

Le plan semaine par semaine jusqu'à la soumission est dans le SPEC §25 :
validations plateforme d'abord, critères et preuves, puis CI et MCP, gel des
fonctionnalités à la mi-décembre, recette et vidéo dans la dernière semaine.
L'avancement réel se lit sur la file Mergify et les checks `ci` des PR.

## Preuve de la chaîne de fusion automatique (mesurée le 11 novembre 2026)

La chaîne « PR verte → file Mergify → merge » et la résolution automatique des
conflits ont été éprouvées sur ce dépôt avec deux sondes volontairement en
conflit sur le même fichier et la même ligne (`docs/PROBE-CONFLIT.md`, supprimé
depuis) :

| Heure (UTC) | Fait |
|---|---|
| 13:15 | PR #20 (sonde A) mergée par la file Mergify |
| 13:18:42 | PR #21 (sonde B) **déqueue** : `CONFLICT_WITH_BASE_BRANCH` |
| 13:19:04 | le balayeur `pr-auto-merge` classe la PR #21 `DIRTY` |
| 13:19:46 | l'agent de conflit (`.github/fireworks/conflict_agent.py`, modèle
`combo/cheap` servi par InferHub) **réconcilie** le fichier, pousse le rebase et
commente la PR |
| 13:22:43 | PR #21 **mergée** par la file, sans intervention humaine |

Le contenu final était l'union sémantique des deux variantes : la réconciliation
est bien le fait du modèle, pas d'un rebase mécanique. Aucune des neuf PR de
lots n'a eu besoin de ce chemin — leurs fichiers étaient disjoints par
construction (`docs/CONTRACTS.md`), ce qui reste la première défense.
