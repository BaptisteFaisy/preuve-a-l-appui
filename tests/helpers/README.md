# Harness de test — Fait, preuve à l'appui

Doubles en mémoire partagés par tous les lots (docs/CONTRACTS.md §5).
**On les utilise, on ne les recopie jamais dans un dossier de lot.**

| Fichier | Ce qu'il fournit | Usage type |
|---|---|---|
| `fake-clock.ts` | `createFakeClock(start)` figée/pilotable, `createFakeIds(prefix)` déterministes, `createRecordingLogger()` traçable | Temps injecté, ids prévisibles, assertions sur les logs |
| `fake-store.ts` | `createFakeStore()` : `ProofStore` en mémoire (Map/Array, zéro I/O) | `store.__tables.criteria` pour vérifier une écriture |
| `fake-store-{core,criteria,evidence,project,ci,insights}.ts` | Le store découpé par zone, comme `src/db/*` : état partagé, critères, preuves/attestations, dérogations/couverture/réglages, CI/liens/living, reporting | Ne pas dupliquer un comportement : l'étendre ici |
| `fake-gateways.ts` + `fake-jira-helpers.ts` | `createFakeJira`, `createFakeEvidenceChecker`, `createFakeLlm`, `createFakeIdentity`, `createFakeQueue`, `createFakeCoverageEngine` | Ports externes pilotables, journal d'appels (`fake.journal.methods()`) |
| `builders.ts` | Fixtures typées : `anIssue()`, `aCriterion()`, `anEvidence()`, `anAttestation()`, `aWaiver()`, `aCiSummary()`, `aTestRun()`, `aTestLink()`, `aCoverage()`, `settings()`… | Composer un jeu de données sans objet brut ni `any` |
| `scenario.ts` | `createPay123Scenario(start)` : PAY-123 du SPEC §7 pré-rempli (4 critères, 2 tests CI verts, 1 déclaration d'agent, dérogation prête) | Rejouer en un appel le blocage (§7.2), l'attestation (§7.3), la dérogation (§7.4) |

Règles : aucune dépendance, aucun import `@forge/*` ni `src/db/*`, aucun `any`,
fichier < 500 lignes, fonction < 50 lignes. Un besoin nouveau ? On complète ce
harness (une PR sur `tests/helpers/**`), jamais un fake local.
