/**
 * Adaptateur SQL : test_link (SPEC §11, §18).
 *
 * Persistance des paires test ↔ critère proposées et confirmées.
 * Invariants Forge SQL :
 * - requêtes bornées (toujours WHERE et LIMIT) ;
 * - écritures rejouables (INSERT INTO test_link ... ON DUPLICATE KEY UPDATE) ;
 * - pas de suppression : une paire confirmée ou rejetée conserve son statut ;
 * - une paire proposée et non confirmée ne compte jamais comme preuve.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient, SqlParam } from './sql-client';
import type { TestLinkStore } from '../ports';
import type { TestLink } from '../types';
import { selectColumns } from './mapping';
import {
  TEST_LINK_COLUMNS,
  testLinkToRow,
  rowToTestLink,
  type TestLinkRow,
} from './mapping-ci';

export const TEST_LINK_LIST_LIMIT = 500;

const TEST_LINK_UPSERT_COLUMNS = TEST_LINK_COLUMNS.filter((col) => col !== 'id');

function buildUpsertTestLink(): string {
  const placeholders = TEST_LINK_COLUMNS.map(() => '?').join(', ');
  const updates = TEST_LINK_UPSERT_COLUMNS.map((col) => `${col} = VALUES(${col})`).join(', ');
  return `INSERT INTO test_link (${TEST_LINK_COLUMNS.join(', ')}) VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates}`;
}

const UPSERT_TEST_LINK = buildUpsertTestLink();

function testLinkValues(row: TestLinkRow): SqlParam[] {
  return [
    row.id,
    row.criterion_id,
    row.test_name,
    row.status,
    row.confidence,
    row.rationale,
    row.confirmed_by,
    row.at,
  ];
}

export function createTestLinkStore(sql: SqlClient): TestLinkStore {
  const columns = selectColumns('test_link');

  return {
    async listLinksByCriterion(criterionId: string): Promise<TestLink[]> {
      const rows = await sql.query<TestLinkRow>(
        `SELECT ${columns} FROM test_link WHERE criterion_id = ?
         ORDER BY at ASC, id ASC LIMIT ${TEST_LINK_LIST_LIMIT}`,
        [criterionId],
      );
      return rows.map(rowToTestLink);
    },

    async listConfirmedLinksByTest(testName: string): Promise<TestLink[]> {
      const rows = await sql.query<TestLinkRow>(
        `SELECT ${columns} FROM test_link WHERE test_name = ? AND status = 'confirmed'
         ORDER BY at ASC, id ASC LIMIT ${TEST_LINK_LIST_LIMIT}`,
        [testName],
      );
      return rows.map(rowToTestLink);
    },

    async listProposedLinks(issueId: string): Promise<TestLink[]> {
      const rows = await sql.query<TestLinkRow>(
        `SELECT ${columns} FROM test_link
         WHERE status = 'proposed' AND criterion_id IN (
           SELECT id FROM criterion WHERE issue_id = ?
         )
         ORDER BY at ASC, id ASC LIMIT ${TEST_LINK_LIST_LIMIT}`,
        [issueId],
      );
      return rows.map(rowToTestLink);
    },

    async saveLink(link: TestLink): Promise<void> {
      const row = testLinkToRow(link);
      await sql.execute(UPSERT_TEST_LINK, testLinkValues(row));
    },
  };
}
