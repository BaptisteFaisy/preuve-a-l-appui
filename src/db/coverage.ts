/**
 * Souche — persistance : coverage (SPEC §18).
 *
 * Propriétaire : lot L3 (docs/CONTRACTS.md §4). Signature gelée : le lot
 * remplace le corps par un vrai adaptateur `SqlClient`, requêtes bornées
 * (toujours un `WHERE`, toujours un `LIMIT`), écritures rejouables.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { CoverageStore } from '../ports.js';
import { stubOf } from './stub.js';

export function createCoverageStore(_sql: SqlClient): CoverageStore {
  return stubOf<CoverageStore>('createCoverageStore', 'L3');
}
