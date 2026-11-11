/**
 * Souche — persistance : waiver (SPEC §18).
 *
 * Propriétaire : lot L3 (docs/CONTRACTS.md §4). Signature gelée : le lot
 * remplace le corps par un vrai adaptateur `SqlClient`, requêtes bornées
 * (toujours un `WHERE`, toujours un `LIMIT`), écritures rejouables.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { WaiverStore } from '../ports.js';
import { stubOf } from './stub.js';

export function createWaiverStore(_sql: SqlClient): WaiverStore {
  return stubOf<WaiverStore>('createWaiverStore', 'L3');
}
