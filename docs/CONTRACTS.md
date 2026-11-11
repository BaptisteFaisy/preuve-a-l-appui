# CONTRAT — « Fait, preuve à l'appui »

Ce fichier est la **carte des lots** et la liste des fichiers **gelés**. Il est
écrit une fois, au socle, puis modifié seulement par une PR dédiée dont le
corps contient la ligne `CONTRACT-CHANGE`.

Règles valables pour tout le dépôt (règle CI de fin octobre 2026) :

- **fichier < 500 lignes**, **fonction < 50 lignes** — au-delà on découpe ;
- **zéro duplication** : un helper existe une fois, dans `tests/helpers/` pour
  les tests, dans `src/domain/` pour la logique ;
- le domaine (`src/domain/`) **n'importe jamais** `@forge/*` : il ne voit que
  `src/types.ts` et `src/ports.ts` ;
- toute chaîne visible par l'utilisateur passe par `src/i18n/` (anglais **et**
  français, SPEC §20) ;
- chaque PR déclare son périmètre dans son corps sous `## Scope` (garde
  `couche0`), et ne touche **que** les fichiers de son lot.

## 1. Fichiers gelés (aucun lot ne les édite)

| Fichier | Rôle |
|---|---|
| `src/types.ts` | vocabulaire du domaine (SPEC §4, §8, §9, §12) |
| `src/ports.ts` | interfaces entre domaine pur et runtime Forge |
| `src/defaults.ts` | grille d'exigences par défaut (SPEC §9.2), rôles, réglages |
| `src/index.ts` | câblage Forge : resolver, actions, triggers, consumer, validateur |
| `src/db/schema.ts` | DDL des douze tables (SPEC §18, §13, §17) |
| `src/db/repo.ts` | assemblage du `ProofStore` |
| `src/db/sql-client.ts` | façade Forge SQL (`SqlClient`, `DdlRunner`) |
| `src/db/mapping.ts` + `mapping-*.ts` | aller-retour ligne SQL ↔ type domaine, dates, JSON |
| `src/db/stub.ts`, `src/deps.ts` | souches nommées, graphe de dépendances |
| `src/i18n/index.ts` | `translate()` pur, sans dictionnaire central |
| `manifest.yml` | modules Forge (SPEC §17) |
| `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts` | outillage |
| `.github/**`, `tools/**` | CI et gardes |
| `tests/helpers/**` | fakes partagés par tous les lots |

Besoin de changer un type, un port ou le manifest ? Une PR **seule**, fichier
par fichier, avec `CONTRACT-CHANGE` dans le corps et la raison.

## 1bis. Le moteur de couverture (point de passage obligé)

`src/domain/coverage-engine.ts` est une souche dont **la signature est gelée** :
`createCoverageEngine(deps): CoverageEngine`. Le lot L3 écrit le corps ; tous
les autres lots appellent `deps.coverage.recompute(issueId)` ou
`deps.coverage.read(issueId)`. C'est ce qui garantit que le validateur, le
consommateur de CI et l'outil `get-proof-status` lisent **la même ligne**
(SPEC §22, point 10) au lieu de recalculer chacun dans son coin.

## 2. Les lots

Chaque lot possède ses fichiers, ses tests et son fichier de messages. Un lot
n'écrit jamais dans le dossier d'un autre.

| Lot | Branche | Possède | Exigences |
|---|---|---|---|
| L0 socle | `socle-app` | fichiers gelés, `src/handlers/*` (souches), `README.md` | — |
| L1 critères | `lot/criteres` | `src/domain/criteria*.ts`, `src/db/criteria.ts`, `src/i18n/criteria.ts`, `tests/domain/criteria*`, `tests/db/criteria*` | FP-01, FP-02, §8.1–8.4 |
| L2 preuves | `lot/preuves` | `src/domain/{evidence,strength,requirements,independence}.ts`, `src/db/evidence.ts`, `src/i18n/evidence.ts`, tests associés | FP-03, FP-04, FP-05, FP-08, FP-13, §9 |
| L3 couverture | `lot/couverture` | `src/domain/{coverage,gate,waivers}.ts`, `src/db/{coverage,settings,waivers}.ts`, `src/handlers/{validator,scheduled}.ts`, `src/i18n/gate.ts`, tests | FP-07, FP-09, FP-12, FP-16, §12 |
| L4 CI | `lot/ci` | `src/ingest/**`, `src/domain/{freshness,living}.ts`, `src/db/{testruns,living}.ts`, `src/handlers/{ingest,consumer,events}.ts`, `src/i18n/ci.ts`, tests | FP-06, FP-19, §10, §13 |
| L5 MCP & Rovo | `lot/mcp` | `src/actions/**`, `src/handlers/dispatch.ts`, `static/agent/prompt.md`, `src/i18n/actions.ts`, tests | FP-11, §15 |
| L6 écrans | `lot/ui` | `src/ui/**`, `src/viewmodel/**`, `src/handlers/resolver.ts`, `src/i18n/ui.ts`, tests | FP-10, FP-16, §16 |
| L7 rapprochement & rapports | `lot/rapprochement` | `src/domain/{matching,stats,dossier}.ts`, `src/db/{links,reporting}.ts`, `src/handlers/attestation-request.ts`, `src/i18n/reports.ts`, tests | FP-14, FP-15, FP-17, FP-18, §11 |
| L8 docs & démo | `lot/docs` | `docs/**` (hors `CAHIER-DES-CHARGES.md` et ce fichier), `src/sample/**`, `static/icon.svg` | §22, §23, §24 |
| L9 adaptateurs | `lot/adaptateurs` | `src/collect/{jira,checker,llm,identity}.ts`, `tests/collect/**` | §8.2, §9.1, §10, §19 |

## 3. Les sept points d'entrée (souches du socle, puis un lot chacun)

`src/index.ts` n'importe que ces fichiers. La souche compile et renvoie une
réponse neutre ; le lot propriétaire remplace le corps **sans changer la
signature exportée**.

| Fichier | Module Forge | Propriétaire |
|---|---|---|
| `src/handlers/validator.ts` | `jira:workflowValidator` | L3 |
| `src/handlers/resolver.ts` | `jira:issuePanel`, `jira:customField`, `jira:projectSettingsPage`, `jira:projectPage` | L6 |
| `src/handlers/ingest.ts` | `webtrigger` (`ci-results`) | L4 |
| `src/handlers/consumer.ts` | `consumer` | L4 |
| `src/handlers/events.ts` | `trigger` (`avi:jira:updated:issue`) | L4 |
| `src/handlers/scheduled.ts` | `scheduledTrigger` (contrôle nocturne) | L3 |
| `src/handlers/dispatch.ts` | `action`, `rovo:mcp` | L5 |

## 4. Persistance

`src/db/repo.ts` assemble le `ProofStore` à partir d'une fabrique par table,
chacune dans le lot qui la possède :

| Fabrique | Fichier | Lot | Tables (SPEC §18) |
|---|---|---|---|
| `createCriterionStore` | `src/db/criteria.ts` | L1 | `criterion`, `criterion_history` |
| `createEvidenceStore` | `src/db/evidence.ts` | L2 | `evidence`, `attestation` |
| `createWaiverStore` | `src/db/waivers.ts` | L3 | `waiver` |
| `createCoverageStore`, `createSettingsStore` | `src/db/coverage.ts`, `src/db/settings.ts` | L3 | `coverage`, `settings` |
| `createTestRunStore` | `src/db/testruns.ts` | L4 | `test_run`, `test_result` |
| `createLivingStore` | `src/db/living.ts` | L4 | `living_proof` |
| `createTestLinkStore` | `src/db/links.ts` | L7 | `test_link` |
| `createReportingStore` | `src/db/reporting.ts` | L7 | lecture seule, agrégats |

Toutes partagent `SqlClient` (`src/db/sql-client.ts`) et `selectList`
(`src/db/rows.ts`). Aucune requête sans `WHERE`, aucune liste sans `LIMIT`.

## 4bis. Adaptateurs (lot L9)

`src/collect/` est le seul endroit autorisé à importer `@forge/api` et
`@forge/llm`. Quatre fichiers, une souche chacun :

| Fabrique | Port | Rôle |
|---|---|---|
| `createJiraGateway` | `JiraGateway` | tickets, rôles, notifications, réécriture de la section critères, champ de couverture |
| `createEvidenceChecker` | `EvidenceChecker` | page Confluence, pièce jointe, section de compte rendu, lien joignable |
| `createLlmGateway` | `LlmGateway` | import des critères, classification, paires test ↔ critère |
| `createIdentityGateway` | `IdentityGateway` | humain ou agent ; tout appel MCP est marqué agent |

## 5. Tests

- un lot livre ses tests avec son code : `tests/<zone>/<module>.test.ts` ;
- les fakes partagés vivent dans `tests/helpers/` (`fakeStore`, `fakeJira`,
  `fakeLlm`, `fakeClock`, `scenario`) — **on les utilise, on ne les recopie
  pas** ;
- la recette du SPEC §22 est couverte par `tests/acceptance/` : un test par
  point de recette, nommé `recette-01` … `recette-11` ;
- `npm run typecheck` et `npm test` doivent passer **dans la PR**, sur le
  runner self-hosted, en moins de 5 minutes.

## 6. Ce qui est hors périmètre pour l'instant

Lot C du SPEC (§6) : preuve vivante avancée, preuve avant code, preuve
croisée, preuve visible par le client. Les types existent déjà
(`minDistinctTypes`, `LivingProof`) pour ne pas casser le contrat plus tard.
