/**
 * Adaptateur de persistance : coverage (SPEC §18).
 *
 * Lit et écrit la couverture d'un ticket avec SqlClient.
 * Requêtes toujours bornées : WHERE obligatoire, LIMIT systématique.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { CoverageStore } from '../ports.js';
import type { Coverage } from '../types.js';
import {
  type CoverageRow,
  coverageToRow,
  insertPlaceholders,
  rowToCoverage,
  selectColumns,
} from './mapping.js';

const TABLE = 'coverage';

export function createCoverageStore(sql: SqlClient): CoverageStore {
  const columns = selectColumns(TABLE);
  const placeholders = insertPlaceholders(TABLE);

  return {
    async getCoverage(issueId: string): Promise<Coverage | null> {
      const statement = `SELECT ${columns} FROM ${TABLE} WHERE issue_id = ? OR issue_key = ? LIMIT 1`;
      const rows = await sql.query<CoverageRow>(statement, [issueId, issueId]);
      const row = rows[0];
      return row ? rowToCoverage(row) : null;
    },

    async saveCoverage(coverage: Coverage): Promise<void> {
      const row = coverageToRow(coverage);
      const values = [
        row.issue_id,
        row.issue_key,
        row.total,
        row.proven,
        row.waived,
        row.mode,
        row.passes,
        row.would_block,
        row.blocking_json,
        row.criteria_json,
        row.updated_at,
      ];

      const statement = `
        INSERT INTO ${TABLE} (${columns})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE
          issue_key = VALUES(issue_key),
          total = VALUES(total),
          proven = VALUES(proven),
          waived = VALUES(waived),
          mode = VALUES(mode),
          passes = VALUES(passes),
          would_block = VALUES(would_block),
          blocking_json = VALUES(blocking_json),
          criteria_json = VALUES(criteria_json),
          updated_at = VALUES(updated_at)
      `;
      await sql.execute(statement, values);
    },

    async listClosedWithoutCoverage(projectId: string, limit: number): Promise<string[]> {
      const boundedLimit = Math.max(1, Math.min(limit, 500));
      // projectId vide = tous les projets (contrôle nocturne global, SPEC §20).
      // Limite annoncée : sans table des clôtures côté SQL, seules les lignes
      // de couverture non passées sont visibles (best-effort documenté).
      const statement =
        projectId.length === 0
          ? `
        SELECT issue_id
        FROM ${TABLE}
        WHERE passes = 0
        ORDER BY updated_at DESC
        LIMIT ${boundedLimit}
      `
          : `
        SELECT issue_id
        FROM ${TABLE}
        WHERE (issue_key LIKE ? OR issue_id LIKE ?)
          AND passes = 0
        ORDER BY updated_at DESC
        LIMIT ${boundedLimit}
      `;
      const prefix = `${projectId}-%`;
      const params = projectId.length === 0 ? [] : [prefix, prefix];
      const rows = await sql.query<{ issue_id: string }>(statement, params);
      return rows.map((r) => r.issue_id);
    },
  };
}
