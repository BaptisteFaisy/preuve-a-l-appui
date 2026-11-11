/**
 * Mapping des runs de CI, de leurs résultats et des paires test ↔ critère
 * (SPEC §10, §11, §18).
 *
 * Deux contraintes du SPEC se lisent ici :
 * - **noms et états seulement, jamais de journal** (SPEC §20) : `test_result`
 *   ne porte que `test_name`, `state` et la durée ;
 * - **une paire proposée n'est jamais une preuve** (SPEC §11) : `status`
 *   distingue `proposed`, `confirmed` et `rejected`, et seule la paire
 *   confirmée (avec `confirmed_by`) compte pour la couverture.
 *
 * `TestOutcome` n'a pas d'identifiant dans le domaine : la ligne est écrite
 * avec le `runId` fourni par le contexte d'écriture, comme `snapshotId` chez
 * Rayon d'impact. La clé primaire `(run_id, test_name)` rend l'écriture
 * rejouable — un lot de CI reçu deux fois n'ajoute pas de ligne (SPEC §10,
 * R4 §1.5 : aucune transaction documentée).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { TestLink, TestOutcome, TestRun } from '../types.js';
import {
  LINK_STATUSES,
  TEST_STATES,
  fromSqlBoolean,
  fromTimestamp,
  isObject,
  parseEnum,
  text,
  toNumber,
  toSqlBoolean,
  toTimestamp,
} from './mapping-common.js';

/* ----------------------------------------------------------------- test run */

/** Une ligne de `test_run`, telle que Forge la rend. */
export interface TestRunRow {
  id: string;
  repo: string;
  branch: string;
  commit: string;
  main_branch: number | boolean;
  received_at: string;
}

export const TEST_RUN_COLUMNS = [
  'id',
  'repo',
  'branch',
  'commit',
  'main_branch',
  'received_at',
] as const satisfies readonly (keyof TestRunRow)[];

export function testRunToRow(run: TestRun): TestRunRow {
  return {
    id: run.id,
    repo: run.repo,
    branch: run.branch,
    commit: run.commit,
    main_branch: toSqlBoolean(run.mainBranch),
    received_at: toTimestamp(run.receivedAt),
  };
}

/**
 * Lit un run. `mainBranch` illisible → `false` : un run dont on ne sait pas
 * s'il vient de la branche principale ne doit pas mettre à jour la preuve
 * vivante des tickets clos (SPEC §13).
 */
export function parseTestRunValue(raw: unknown): TestRun {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    repo: text(source['repo']),
    branch: text(source['branch']),
    commit: text(source['commit']),
    mainBranch: fromSqlBoolean(source['mainBranch']),
    receivedAt: fromTimestamp(source['receivedAt']),
  };
}

export function rowToTestRun(row: TestRunRow): TestRun {
  return parseTestRunValue({
    id: row.id,
    repo: row.repo,
    branch: row.branch,
    commit: row.commit,
    mainBranch: row.main_branch,
    receivedAt: row.received_at,
  });
}

/* -------------------------------------------------------------- test result */

/** Une ligne de `test_result`, telle que Forge la rend. */
export interface TestResultRow {
  run_id: string;
  test_name: string;
  state: string;
  duration_ms: number;
}

export const TEST_RESULT_COLUMNS = [
  'run_id',
  'test_name',
  'state',
  'duration_ms',
] as const satisfies readonly (keyof TestResultRow)[];

/** Écrit la ligne d'un résultat ; `runId` vient du contexte d'écriture. */
export function testOutcomeToRow(outcome: TestOutcome, runId: string): TestResultRow {
  return {
    run_id: runId,
    test_name: outcome.name,
    state: outcome.state,
    duration_ms: outcome.durationMs,
  };
}

/**
 * Lit un résultat. État inconnu → `absent` : un test dont on ne sait pas lire
 * l'état est traité comme non exécuté, ce qui fait tomber la preuve qu'il
 * portait (SPEC §13, le cas le plus sournois).
 */
export function parseTestOutcomeValue(raw: unknown): TestOutcome {
  const source = isObject(raw) ? raw : {};
  return {
    name: text(source['name']),
    state: parseEnum(source['state'], TEST_STATES, 'absent'),
    durationMs: toNumber(source['durationMs']),
  };
}

export function rowToTestOutcome(row: TestResultRow): TestOutcome {
  return parseTestOutcomeValue({
    name: row.test_name,
    state: row.state,
    durationMs: row.duration_ms,
  });
}

/* ---------------------------------------------------------------- test link */

/** Une ligne de `test_link`, telle que Forge la rend. */
export interface TestLinkRow {
  id: string;
  criterion_id: string;
  test_name: string;
  status: string;
  confidence: number;
  rationale: string;
  confirmed_by: string;
  at: string;
}

export const TEST_LINK_COLUMNS = [
  'id',
  'criterion_id',
  'test_name',
  'status',
  'confidence',
  'rationale',
  'confirmed_by',
  'at',
] as const satisfies readonly (keyof TestLinkRow)[];

export function testLinkToRow(link: TestLink): TestLinkRow {
  return {
    id: link.id,
    criterion_id: link.criterionId,
    test_name: link.testName,
    status: link.status,
    confidence: link.confidence,
    rationale: link.rationale,
    confirmed_by: link.confirmedBy,
    at: toTimestamp(link.at),
  };
}

/**
 * Lit une paire. Statut illisible → `proposed` : une paire dont on ne sait pas
 * lire la confirmation n'est jamais une preuve. `confidence` est un `DOUBLE`
 * en base, mais peut revenir en chaîne (R4 §1.2) : `toNumber` couvre les deux.
 */
export function parseTestLinkValue(raw: unknown): TestLink {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    criterionId: text(source['criterionId']),
    testName: text(source['testName']),
    status: parseEnum(source['status'], LINK_STATUSES, 'proposed'),
    confidence: toNumber(source['confidence']),
    rationale: text(source['rationale']),
    confirmedBy: text(source['confirmedBy']),
    at: fromTimestamp(source['at']),
  };
}

export function rowToTestLink(row: TestLinkRow): TestLink {
  return parseTestLinkValue({
    id: row.id,
    criterionId: row.criterion_id,
    testName: row.test_name,
    status: row.status,
    confidence: row.confidence,
    rationale: row.rationale,
    confirmedBy: row.confirmed_by,
    at: row.at,
  });
}
