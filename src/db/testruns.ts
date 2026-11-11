/**
 * Souche — persistance : test_run, test_result (SPEC §18).
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md §4). Signature gelée : le lot
 * remplace le corps par un vrai adaptateur `SqlClient`, requêtes bornées
 * (toujours un `WHERE`, toujours un `LIMIT`), écritures rejouables.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { TestRunStore } from '../ports.js';
import { stubOf } from './stub.js';

export function createTestRunStore(_sql: SqlClient): TestRunStore {
  return stubOf<TestRunStore>('createTestRunStore', 'L4');
}
