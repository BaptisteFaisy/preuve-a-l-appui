/**
 * Souche — persistance : test_link (SPEC §18).
 *
 * Propriétaire : lot L7 (docs/CONTRACTS.md §4). Signature gelée : le lot
 * remplace le corps par un vrai adaptateur `SqlClient`, requêtes bornées
 * (toujours un `WHERE`, toujours un `LIMIT`), écritures rejouables.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { TestLinkStore } from '../ports.js';
import { stubOf } from './stub.js';

export function createTestLinkStore(_sql: SqlClient): TestLinkStore {
  return stubOf<TestLinkStore>('createTestLinkStore', 'L7');
}
