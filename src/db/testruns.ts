/**
 * Adaptateur SQL des runs de CI et de leurs résultats (SPEC §10, §18).
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md §4). Trois invariants Forge SQL :
 * - requêtes **bornées** : toujours un `WHERE`, toujours un `LIMIT` explicite ;
 * - écritures **rejouables** : un lot de CI reçu deux fois n'ajoute pas de
 *   ligne (`INSERT IGNORE` sur la clé `(run_id, test_name)`) ;
 * - lecture **sans exception** : une ligne absente rend `null`, une liste vide
 *   rend `[]`, une colonne illisible prend son repli (`mapping-ci.ts`).
 *
 * Noms et états seulement, jamais de journal (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { TestRunStore } from '../ports';
import type { TestOutcome, TestRun } from '../types';
import {
  TEST_RESULT_COLUMNS,
  TEST_RUN_COLUMNS,
  rowToTestOutcome,
  rowToTestRun,
  testOutcomeToRow,
  testRunToRow,
  type TestResultRow,
  type TestRunRow,
} from './mapping-ci';
import { selectColumns } from './mapping';
import type { SqlClient, SqlParam } from './sql-client';

/** Borne de toute liste de résultats rendue à l'appelant (SPEC §20). */
export const TEST_RESULTS_LIMIT = 2000;

/** Colonnes rejouées d'un run (clé primaire `id` exclue). */
const RUN_UPSERT_COLUMNS = TEST_RUN_COLUMNS.filter((column) => column !== 'id');

const UPSERT_RUN = `INSERT INTO test_run (${TEST_RUN_COLUMNS.join(', ')})
  VALUES (${TEST_RUN_COLUMNS.map(() => '?').join(', ')})
  ON DUPLICATE KEY UPDATE ${RUN_UPSERT_COLUMNS.map((column) => `${column} = VALUES(${column})`).join(', ')}`;

/** Un résultat déjà écrit n'est jamais réécrit : la paire est la preuve. */
const INSERT_RESULT = `INSERT IGNORE INTO test_result (${TEST_RESULT_COLUMNS.join(', ')})
  VALUES (${TEST_RESULT_COLUMNS.map(() => '?').join(', ')})`;

/** Le dernier run d'une branche : une seule ligne, jamais une liste ouverte. */
const LATEST_RUN = (columns: string): string =>
  `SELECT ${columns} FROM test_run WHERE repo = ? AND branch = ?
   ORDER BY received_at DESC, id DESC LIMIT 1`;

function runValues(row: TestRunRow): SqlParam[] {
  return [
    row.id,
    row.repo,
    row.branch,
    row.commit,
    row.main_branch,
    row.received_at,
  ];
}

function resultValues(row: TestResultRow): SqlParam[] {
  return [row.run_id, row.test_name, row.state, row.duration_ms];
}

/** Résultats d'un run, bornés ; sert aussi bien à la lecture directe qu'au dernier run. */
async function readResults(sql: SqlClient, runId: string): Promise<TestOutcome[]> {
  const rows = await sql.query<TestResultRow>(
    `SELECT ${selectColumns('test_result')} FROM test_result WHERE run_id = ?
     ORDER BY test_name ASC LIMIT ${TEST_RESULTS_LIMIT}`,
    [runId],
  );
  return rows.map(rowToTestOutcome);
}

export function createTestRunStore(sql: SqlClient): TestRunStore {
  const runColumns = selectColumns('test_run');

  return {
    async saveTestRun(run: TestRun): Promise<void> {
      await sql.execute(UPSERT_RUN, runValues(testRunToRow(run)));
    },

    async getTestRun(runId: string): Promise<TestRun | null> {
      const rows = await sql.query<TestRunRow>(
        `SELECT ${runColumns} FROM test_run WHERE id = ? LIMIT 1`,
        [runId],
      );
      const row = rows[0];
      return row === undefined ? null : rowToTestRun(row);
    },

    async addTestResults(runId: string, outcomes: readonly TestOutcome[]): Promise<number> {
      let written = 0;
      for (const outcome of outcomes) {
        written += await sql.execute(INSERT_RESULT, resultValues(testOutcomeToRow(outcome, runId)));
      }
      return written;
    },

    async listTestResults(runId: string): Promise<TestOutcome[]> {
      return readResults(sql, runId);
    },

    async latestRunForBranch(repo: string, branch: string): Promise<TestRun | null> {
      const rows = await sql.query<TestRunRow>(LATEST_RUN(runColumns), [repo, branch]);
      const row = rows[0];
      return row === undefined ? null : rowToTestRun(row);
    },

    /**
     * Les résultats du dernier run d'une branche (SPEC §9.3 : c'est lui qui
     * décide de la fraîcheur). Deux requêtes bornées, pas de jointure non
     * bornée ; un run absent rend `[]`, jamais une exception.
     */
    async latestOutcomesForBranch(repo: string, branch: string): Promise<TestOutcome[]> {
      const rows = await sql.query<TestRunRow>(LATEST_RUN(runColumns), [repo, branch]);
      const run = rows[0];
      if (run === undefined) return [];
      return readResults(sql, run.id);
    },
  };
}
