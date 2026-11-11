/**
 * Souche — persistance : criterion, criterion_history (SPEC §18).
 *
 * Propriétaire : lot L1 (docs/CONTRACTS.md §4). Signature gelée : le lot
 * remplace le corps par un vrai adaptateur `SqlClient`, requêtes bornées
 * (toujours un `WHERE`, toujours un `LIMIT`), écritures rejouables.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { CriterionStore } from '../ports.js';
import { stubOf } from './stub.js';

export function createCriterionStore(_sql: SqlClient): CriterionStore {
  return stubOf<CriterionStore>('createCriterionStore', 'L1');
}
