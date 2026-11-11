# Recette de bout en bout — SPEC §22 (lot L10)

Ce dossier prouve que les **onze points de recette** du cahier des charges
(§22) tiennent avec les **vrais modules assemblés**, pas des fakes isolés :
moteur de couverture réel, validateur, entrée de CI, consommateur, événements
Jira, dispatch MCP, résolveur des écrans et domaine (indépendance, dérogations,
fraîcheur, changement de critère, dossier).

## Rejouer la recette

```bash
npx vitest run tests/acceptance          # les 11 points, ~1 s
npx vitest run                           # toute la suite (recette comprise)
npx tsc --noEmit                         # 0 erreur
python3 tools/check-file-limits.py       # fichiers < 500 lignes
node tools/check-function-limits.mjs     # fonctions < 50 lignes
```

Aucun réseau, aucun ordre d'exécution requis, horloge injectée : chaque test
recrée son harnais et rejoue le scénario PAY-123 (§7) depuis
`tests/helpers/scenario.ts`.

## Comment c'est câblé

`harness.ts` est le seul point d'assemblage. Il :

1. construit le scénario PAY-123 (4 critères, 2 tests verts, 1 déclaration
   d'agent, 1 critère nu, une dérogation prête) ;
2. remplace le double de couverture du scénario par le **vrai** moteur
   `createCoverageEngine` — le point de passage obligé qui garantit que le
   validateur, le consommateur et `get-proof-status` lisent **la même ligne**
   (SPEC §22 point 10, docs/CONTRACTS.md §1bis) ;
3. câble les vrais handlers (`createValidator`, `handleCiResults`,
   `onCiMessage`, `onJiraEvent`, `runAction`, `registerResolvers`) sur les fakes
   en mémoire de `tests/helpers/` ;
4. expose des gestes fidèles : `runCi(summary)` fait arriver un résumé par le
   web trigger signé puis le consommateur, `validate()` joue la transition vers
   « Terminé », `tool(name, …)` appelle un outil MCP, `gesture(key, …)` un geste
   du panneau.

## Les fichiers

| Fichier | Points §22 |
|---|---|
| `recette-01.test.ts` | 1, 10 |
| `recette-02.test.ts` | 2, 3 |
| `recette-03.test.ts` | 4, 5 |
| `recette-04.test.ts` | 6, 9 |
| `recette-05.test.ts` | 7, 8 |
| `recette-06.test.ts` | 11 |

Chaque point porte un `it('recette-NN : …')` traçable. Le tableau complet — ce
qui est prouvé, par quel test, et comment le rejouer à la main dans Jira — est
dans [`docs/RECETTE.md`](../../docs/RECETTE.md).

## Écart d'intégration connu

`recette-03.test.ts` contient un `it.fails` : le geste humain
`attest-criterion` du résolveur (lot L6) n'applique pas `canAttest`
(`src/domain/independence.ts`), donc l'indépendance de l'attestation n'est pas
vérifiée au moment de l'écriture. La règle de domaine est juste et prouvée ;
c'est le câblage qui manque. Détails dans le compte rendu de livraison (section
ÉCARTS) et dans `docs/RECETTE.md`.
