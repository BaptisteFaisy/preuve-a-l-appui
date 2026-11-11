/**
 * Adaptateur de persistance : settings (SPEC §18, §9.2).
 *
 * Lit et écrit les réglages par projet avec SqlClient.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { SettingsStore } from '../ports.js';
import type { ProjectSettings } from '../types.js';
import {
  insertPlaceholders,
  type ProjectSettingsRow,
  projectSettingsToRow,
  rowToProjectSettings,
  selectColumns,
} from './mapping.js';

const TABLE = 'settings';

export function createSettingsStore(sql: SqlClient): SettingsStore {
  const columns = selectColumns(TABLE);
  const placeholders = insertPlaceholders(TABLE);

  return {
    async getSettings(projectId: string): Promise<ProjectSettings | null> {
      const statement = `SELECT ${columns} FROM ${TABLE} WHERE project_id = ? LIMIT 1`;
      const rows = await sql.query<ProjectSettingsRow>(statement, [projectId]);
      const row = rows[0];
      return row ? rowToProjectSettings(row) : null;
    },

    async saveSettings(settings: ProjectSettings): Promise<void> {
      const row = projectSettingsToRow(settings);
      const values = [
        row.project_id,
        row.requirements_json,
        row.mode,
        row.roles_json,
        row.missing_criteria,
        row.ci_key_hash,
        row.require_children,
        row.language,
        row.updated_at,
      ];

      const statement = `
        INSERT INTO ${TABLE} (${columns})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE
          requirements_json = VALUES(requirements_json),
          mode = VALUES(mode),
          roles_json = VALUES(roles_json),
          missing_criteria = VALUES(missing_criteria),
          ci_key_hash = VALUES(ci_key_hash),
          require_children = VALUES(require_children),
          language = VALUES(language),
          updated_at = VALUES(updated_at)
      `;
      await sql.execute(statement, values);
    },

    async findProjectByCiKeyHash(hash: string): Promise<ProjectSettings | null> {
      if (!hash || hash.trim().length === 0) return null;
      const statement = `SELECT ${columns} FROM ${TABLE} WHERE ci_key_hash = ? LIMIT 1`;
      const rows = await sql.query<ProjectSettingsRow>(statement, [hash]);
      const row = rows[0];
      return row ? rowToProjectSettings(row) : null;
    },
  };
}
