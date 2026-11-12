/**
 * Schéma Forge SQL de « Fait, preuve à l'appui » (SPEC §18, §13, §17).
 *
 * Trois faits dictent la forme de ce fichier (R4 §1.3, §3, §6) :
 *
 * 1. **Pas de clé étrangère** dans Forge SQL, et aucun `DELETE` en cascade :
 *    l'intégrité référentielle vit dans `repo.ts`, et chaque `*_id` est un
 *    `VARCHAR(64)` indexé. Rien n'est supprimé : une preuve est *remplacée*
 *    (`evidence.replaced_by`), une dérogation est *révoquée*
 *    (`waiver.revoked_at`), un critère modifié garde ses versions
 *    (`criterion_history`) — SPEC §20.
 * 2. **Aucune déclaration de table en TypeScript** : le schéma *est* du DDL,
 *    appliqué par `migrationRunner`. Chaque étape est idempotente
 *    (`CREATE TABLE IF NOT EXISTS` + index en ligne, seule forme idempotente
 *    sous TiDB, qui n'a pas de `CREATE INDEX IF NOT EXISTS`).
 * 3. **Le type `JSON` est en sursis** (« may not be supported in future
 *    versions ») et revient de toute façon en `string` : tout payload est
 *    stocké en `TEXT` et sérialisé par `mapping.ts`. Les dates sont des
 *    `TIMESTAMP` ; la conversion ISO-8601 ↔ `YYYY-MM-DD HH:MM:SS.fff` est
 *    faite une seule fois, dans `mapping-common.ts`.
 *
 * Piège local : `commit` est un mot réservé MySQL/TiDB — la colonne est
 * écrite entre backticks ici, et `selectColumns()` (mapping.ts) la requote
 * pour chaque requête.
 *
 * Colonnes ajoutées au-delà du §18 (le tableau du SPEC liste les « colonnes
 * principales », le contrat `src/types.ts` fait foi) : elles sont nécessaires
 * pour qu'un objet écrit puis relu soit identique, sans perte de champ.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DdlMigration, DdlRunner } from './sql-client';
import { forgeDdlRunner } from './sql-client';

/** Les douze tables de l'app : dix au SPEC §18, plus §13 et §17. */
export const TABLES = [
  'criterion',
  'criterion_history',
  'evidence',
  'attestation',
  'waiver',
  'test_run',
  'test_result',
  'test_link',
  'coverage',
  'settings',
  // SPEC §13 : la preuve vivante, surveillée après la clôture du ticket.
  'living_proof',
  // SPEC §17 (lot S) : le dossier de preuve d'une version, exporté tel quel.
  'release_dossier',
] as const;

export type TableName = (typeof TABLES)[number];

/**
 * Critères d'acceptation (SPEC §8.1). `code` (`AC-1`) reste stable quand le
 * texte change ; `version` incrémente et l'ancienne version passe en
 * `superseded` (SPEC §8.4). Ajouts au §18 : `created_by`, `created_at`,
 * `updated_at` (champs du contrat `Criterion`).
 */
export const CREATE_CRITERION = `
  CREATE TABLE IF NOT EXISTS criterion (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    issue_id VARCHAR(64) NOT NULL,
    code VARCHAR(32) NOT NULL,
    text TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    required_strength VARCHAR(24) NOT NULL,
    version INT NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    INDEX idx_criterion_issue (issue_id, status),
    INDEX idx_criterion_code (issue_id, code)
  )`;

/**
 * Historique des versions d'un critère (SPEC §8.4) : une ligne par version,
 * jamais réécrite. Ajout au §18 : `type` (champ de `CriterionRevision`).
 */
export const CREATE_CRITERION_HISTORY = `
  CREATE TABLE IF NOT EXISTS criterion_history (
    criterion_id VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    text TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    changed_by VARCHAR(128) NOT NULL,
    at TIMESTAMP NOT NULL,
    PRIMARY KEY (criterion_id, version),
    INDEX idx_criterion_history_at (criterion_id, at)
  )`;

/**
 * Preuves (SPEC §9). Le §18 note `fresh` : le domaine a trois états
 * (`fresh`, `to-reconfirm`, `stale`, SPEC §9.3), d'où la colonne `freshness`.
 * Ajouts au §18 : `note`, `verified`, `replaced_by` — ce dernier porte
 * l'intégrité du SPEC §20 (on remplace, on ne supprime jamais).
 */
export const CREATE_EVIDENCE = `
  CREATE TABLE IF NOT EXISTS evidence (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    criterion_id VARCHAR(64) NOT NULL,
    criterion_version INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    \`reference\` VARCHAR(512) NOT NULL,
    note TEXT NOT NULL,
    strength VARCHAR(24) NOT NULL,
    \`commit\` VARCHAR(64) NOT NULL,
    freshness VARCHAR(16) NOT NULL,
    verified BOOLEAN NOT NULL,
    added_by VARCHAR(128) NOT NULL,
    added_by_agent BOOLEAN NOT NULL,
    at TIMESTAMP NOT NULL,
    replaced_by VARCHAR(64) NOT NULL,
    INDEX idx_evidence_criterion (criterion_id, criterion_version),
    INDEX idx_evidence_reference (\`reference\`)
  )`;

/**
 * Attestations tierces (SPEC §9.1, §9.4). Ajout au §18 : `evidence_id`, la
 * preuve (souvent une capture) que l'attestation vient renforcer.
 */
export const CREATE_ATTESTATION = `
  CREATE TABLE IF NOT EXISTS attestation (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    criterion_id VARCHAR(64) NOT NULL,
    evidence_id VARCHAR(64) NOT NULL,
    attester_account_id VARCHAR(64) NOT NULL,
    role VARCHAR(128) NOT NULL,
    note TEXT NOT NULL,
    attachment_ref VARCHAR(512) NOT NULL,
    at TIMESTAMP NOT NULL,
    INDEX idx_attestation_criterion (criterion_id, at),
    INDEX idx_attestation_evidence (evidence_id),
    INDEX idx_attestation_attester (attester_account_id)
  )`;

/**
 * Dérogations (SPEC §12.4) : motivées, signées, révocables, jamais supprimées.
 * Ajouts au §18 : `role` (qui a le droit de déroger), `expires_at` (vide =
 * « jusqu'à la clôture du ticket ») et `revoked_at` (vide = toujours active).
 */
export const CREATE_WAIVER = `
  CREATE TABLE IF NOT EXISTS waiver (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    criterion_id VARCHAR(64) NOT NULL,
    granted_by VARCHAR(128) NOT NULL,
    role VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NOT NULL,
    INDEX idx_waiver_criterion (criterion_id, at)
  )`;

/**
 * Un résumé de CI reçu (SPEC §10). Ajout au §18 : `main_branch` — c'est ce
 * qui déclenche la mise à jour de la preuve vivante (SPEC §13).
 */
export const CREATE_TEST_RUN = `
  CREATE TABLE IF NOT EXISTS test_run (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    repo VARCHAR(255) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    \`commit\` VARCHAR(64) NOT NULL,
    main_branch BOOLEAN NOT NULL,
    received_at TIMESTAMP NOT NULL,
    INDEX idx_test_run_branch (repo, branch, received_at),
    INDEX idx_test_run_main (main_branch, received_at)
  )`;

/**
 * Noms et états des tests d'un run (SPEC §10, §20 : jamais de journal).
 * Ajout au §18 : `duration_ms` (champ de `TestOutcome`).
 */
export const CREATE_TEST_RESULT = `
  CREATE TABLE IF NOT EXISTS test_result (
    run_id VARCHAR(64) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    state VARCHAR(16) NOT NULL,
    duration_ms INT NOT NULL,
    PRIMARY KEY (run_id, test_name),
    INDEX idx_test_result_name (test_name, state)
  )`;

/**
 * Paires test ↔ critère proposées puis confirmées (SPEC §11). Ajouts au §18 :
 * `id` (clé primaire), `status` (`proposed` ne compte jamais comme preuve) et
 * `rationale` (la phrase montrée à l'humain qui confirme).
 * `confidence` est un `DOUBLE` : un `DECIMAL` reviendrait en `string` (R4 §1.2).
 */
export const CREATE_TEST_LINK = `
  CREATE TABLE IF NOT EXISTS test_link (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    criterion_id VARCHAR(64) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL,
    confidence DOUBLE NOT NULL,
    rationale TEXT NOT NULL,
    confirmed_by VARCHAR(128) NOT NULL,
    at TIMESTAMP NOT NULL,
    INDEX idx_test_link_criterion (criterion_id, status),
    INDEX idx_test_link_test (test_name, status)
  )`;

/**
 * La couverture d'un ticket, recalculée à chaque changement (SPEC §12.3) :
 * le validateur ne lit que cette ligne (SPEC §17). Ajouts au §18 :
 * `issue_key`, `mode`, `passes`, `would_block` (mode observation, SPEC §12.2)
 * et `criteria_json` (la matrice, SPEC §16.1).
 */
export const CREATE_COVERAGE = `
  CREATE TABLE IF NOT EXISTS coverage (
    issue_id VARCHAR(64) NOT NULL PRIMARY KEY,
    issue_key VARCHAR(32) NOT NULL,
    total INT NOT NULL,
    proven INT NOT NULL,
    waived INT NOT NULL,
    mode VARCHAR(16) NOT NULL,
    passes BOOLEAN NOT NULL,
    would_block BOOLEAN NOT NULL,
    blocking_json TEXT NOT NULL,
    criteria_json TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    INDEX idx_coverage_updated (updated_at)
  )`;

/**
 * Réglages par projet (SPEC §9.2, §12.2). Ajouts au §18 : `missing_criteria`
 * (SPEC §8.3), `require_children` (SPEC §21), `language` (SPEC §20) et
 * `updated_at`. `ci_key_hash` est indexé : c'est par lui qu'un résumé de CI
 * retrouve son projet (SPEC §10).
 */
export const CREATE_SETTINGS = `
  CREATE TABLE IF NOT EXISTS settings (
    project_id VARCHAR(64) NOT NULL PRIMARY KEY,
    requirements_json TEXT NOT NULL,
    mode VARCHAR(16) NOT NULL,
    roles_json TEXT NOT NULL,
    missing_criteria VARCHAR(16) NOT NULL,
    ci_key_hash VARCHAR(128) NOT NULL,
    require_children BOOLEAN NOT NULL,
    language VARCHAR(8) NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    INDEX idx_settings_ci_key (ci_key_hash)
  )`;

/**
 * Preuve vivante (SPEC §13) : le critère livré reste relié au test qui le
 * garantit. `project_id` n'est pas dans le type `LivingProof` : c'est le
 * contexte d'écriture fourni par `repo.ts` (comme `snapshotId` chez
 * Rayon d'impact), et il porte le filtre `listLivingByProject`.
 */
export const CREATE_LIVING_PROOF = `
  CREATE TABLE IF NOT EXISTS living_proof (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    issue_key VARCHAR(32) NOT NULL,
    criterion_id VARCHAR(64) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    state VARCHAR(16) NOT NULL,
    component VARCHAR(255) NOT NULL,
    \`commit\` VARCHAR(64) NOT NULL,
    since TIMESTAMP NOT NULL,
    INDEX idx_living_project (project_id, state),
    INDEX idx_living_issue (issue_key),
    INDEX idx_living_criterion (criterion_id)
  )`;

/**
 * Dossier de preuve d'une version (SPEC §17, lot S) : un instantané figé,
 * exporté dans Confluence tel quel. Les tickets et les totaux sont du TEXT
 * sérialisé — le dossier se lit d'un bloc, jamais ligne à ligne.
 */
export const CREATE_RELEASE_DOSSIER = `
  CREATE TABLE IF NOT EXISTS release_dossier (
    version_id VARCHAR(64) NOT NULL PRIMARY KEY,
    version_name VARCHAR(255) NOT NULL,
    project_key VARCHAR(32) NOT NULL,
    generated_at TIMESTAMP NOT NULL,
    issues_json TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    INDEX idx_dossier_project (project_key, generated_at)
  )`;

/** DDL par table : la source unique des migrations et des tests de schéma. */
export const TABLE_DDL: Record<TableName, string> = {
  criterion: CREATE_CRITERION,
  criterion_history: CREATE_CRITERION_HISTORY,
  evidence: CREATE_EVIDENCE,
  attestation: CREATE_ATTESTATION,
  waiver: CREATE_WAIVER,
  test_run: CREATE_TEST_RUN,
  test_result: CREATE_TEST_RESULT,
  test_link: CREATE_TEST_LINK,
  coverage: CREATE_COVERAGE,
  settings: CREATE_SETTINGS,
  living_proof: CREATE_LIVING_PROOF,
  release_dossier: CREATE_RELEASE_DOSSIER,
};

/** Nom de migration stable : rejouer le même nom ne fait rien côté Forge. */
export function migrationName(table: TableName): string {
  return `v001_create_${table}`;
}

/** Toutes les étapes du schéma, dans l'ordre de création. */
export function schemaMigrations(): DdlMigration[] {
  return TABLES.map((table) => ({ name: migrationName(table), ddl: TABLE_DDL[table] }));
}

/**
 * Applique le schéma via `migrationRunner` (le runner Forge par défaut).
 * Idempotent : un second appel rejoue les mêmes noms avec le même DDL
 * `IF NOT EXISTS` et ne change rien. Renvoie les noms appliqués.
 *
 * Les erreurs ne sont pas avalées : la limite de 25 DDL/min produit des
 * échecs transitoires, c'est à l'appelant (consumer de migration) de rejouer.
 */
export function applySchema(runner: DdlRunner = forgeDdlRunner): Promise<string[]> {
  return runner.run(schemaMigrations());
}
