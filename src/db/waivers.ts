/**
 * Adaptateur de persistance : waivers (SPEC §18, §12.4).
 *
 * Lit et écrit les dérogations avec SqlClient.
 * Intégrité : aucune dérogation n'est physiquement supprimée (revoked_at).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client';
import type { WaiverStore } from '../ports';
import type { Waiver } from '../types';
import {
  insertPlaceholders,
  rowToWaiver,
  selectColumns,
  type WaiverRow,
  waiverToRow,
} from './mapping';

const TABLE = 'waiver';

export function createWaiverStore(sql: SqlClient): WaiverStore {
  const columns = selectColumns(TABLE);
  const placeholders = insertPlaceholders(TABLE);

  return {
    async listWaiversByCriterion(criterionId: string): Promise<Waiver[]> {
      const statement = `
        SELECT ${columns}
        FROM ${TABLE}
        WHERE criterion_id = ?
        ORDER BY at ASC
        LIMIT 100
      `;
      const rows = await sql.query<WaiverRow>(statement, [criterionId]);
      return rows.map(rowToWaiver);
    },

    async listWaiversByIssue(issueId: string): Promise<Waiver[]> {
      const statement = `
        SELECT w.id, w.criterion_id, w.granted_by, w.role, w.reason, w.at, w.expires_at, w.revoked_at
        FROM ${TABLE} w
        JOIN criterion c ON c.id = w.criterion_id
        WHERE c.issue_id = ?
        ORDER BY w.at ASC
        LIMIT 500
      `;
      const rows = await sql.query<WaiverRow>(statement, [issueId]);
      return rows.map(rowToWaiver);
    },

    async listWaiversByProject(projectKey: string, since: string): Promise<Waiver[]> {
      // Les dérogations d'un projet se trouvent par la clé du projet : les
      // tickets du projet sont ceux dont la couverture commence par la clé
      // (`PAY-1`). On ne peut pas se fier à un préfixe d'id de ticket : Jira
      // donne des ids numériques ('66653') sans rapport avec le projet.
      const statement = `
        SELECT w.id, w.criterion_id, w.granted_by, w.role, w.reason, w.at, w.expires_at, w.revoked_at
        FROM ${TABLE} w
        JOIN criterion c ON c.id = w.criterion_id
        WHERE c.issue_id IN (
          SELECT cov.issue_id FROM coverage cov WHERE cov.issue_key LIKE ?
        )
          AND w.at >= ?
        ORDER BY w.at ASC
        LIMIT 500
      `;
      const rows = await sql.query<WaiverRow>(statement, [`${projectKey}-%`, since]);
      return rows.map(rowToWaiver);
    },

    async saveWaiver(waiver: Waiver): Promise<void> {
      const row = waiverToRow(waiver);
      const values = [
        row.id,
        row.criterion_id,
        row.granted_by,
        row.role,
        row.reason,
        row.at,
        row.expires_at,
        row.revoked_at,
      ];
      const statement = `
        INSERT INTO ${TABLE} (${columns})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE
          role = VALUES(role),
          reason = VALUES(reason),
          expires_at = VALUES(expires_at),
          revoked_at = VALUES(revoked_at)
      `;
      await sql.execute(statement, values);
    },

    async revokeWaiver(waiverId: string, at: string): Promise<boolean> {
      const statement = `
        UPDATE ${TABLE}
        SET revoked_at = ?
        WHERE id = ? AND revoked_at = ''
      `;
      const affected = await sql.execute(statement, [at, waiverId]);
      return affected > 0;
    },
  };
}
