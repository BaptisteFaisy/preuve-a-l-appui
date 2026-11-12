/**
 * Adaptateur SQL des critères (SPEC §8, §18) : tables `criterion` et
 * `criterion_history`.
 *
 * Propriétaire : lot L1 (docs/CONTRACTS.md §4). Trois invariants Forge SQL :
 * - requêtes **bornées** : toujours un `WHERE`, toujours un `LIMIT` explicite ;
 * - écritures **rejouables** : `INSERT … ON DUPLICATE KEY UPDATE`, rejouer un
 *   écrit ne duplique ni ne casse rien ;
 * - lecture **sans exception** : une ligne absente rend `null`, une liste vide
 *   rend `[]`, une colonne illisible prend son repli (mapping-criteria.ts).
 *
 * Aucun `DELETE` : un critère remplacé garde ses versions dans
 * `criterion_history` (SPEC §20, intégrité).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Criterion, CriterionRevision } from '../types';
import type { CriterionStore } from '../ports';
import type { SqlClient, SqlParam } from './sql-client';
import { selectColumns } from './mapping';
import { nextCode } from '../domain/criteria';
import {
  CRITERION_COLUMNS,
  CRITERION_HISTORY_COLUMNS,
  criterionRevisionToRow,
  criterionToRow,
  rowToCriterion,
  rowToCriterionRevision,
  type CriterionRevisionRow,
  type CriterionRow,
} from './mapping-criteria';

/** Borne de toute liste de critères ou de révisions (SPEC §20 : rien d'infini). */
export const CRITERIA_LIST_LIMIT = 500;

/** Colonnes mises à jour par un rejeu d'écriture (clé primaire exclue). */
const CRITERION_UPSERT_COLUMNS = CRITERION_COLUMNS.filter((column) => column !== 'id');
const HISTORY_UPSERT_COLUMNS = CRITERION_HISTORY_COLUMNS.filter(
  (column) => column !== 'criterion_id' && column !== 'version',
);

/**
 * Construit un upsert idempotent : `INSERT … ON DUPLICATE KEY UPDATE`.
 * Les paramètres sont ceux de la ligne, suivis des colonnes rejouées.
 */
function upsertStatement(
  table: 'criterion' | 'criterion_history',
  columns: readonly string[],
  upsertColumns: readonly string[],
): string {
  const placeholders = columns.map(() => '?').join(', ');
  const updates = upsertColumns.map((column) => `${column} = VALUES(${column})`).join(', ');
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates}`;
}

const UPSERT_CRITERION = upsertStatement('criterion', CRITERION_COLUMNS, CRITERION_UPSERT_COLUMNS);
const UPSERT_HISTORY = upsertStatement(
  'criterion_history',
  CRITERION_HISTORY_COLUMNS,
  HISTORY_UPSERT_COLUMNS,
);

function criterionValues(row: CriterionRow): SqlParam[] {
  return [
    row.id,
    row.issue_id,
    row.code,
    row.text,
    row.type,
    row.required_strength,
    row.version,
    row.status,
    row.created_by,
    row.created_at,
    row.updated_at,
    ...CRITERION_UPSERT_COLUMNS.map((column) => row[column]),
  ];
}

function historyValues(row: CriterionRevisionRow): SqlParam[] {
  return [
    row.criterion_id,
    row.version,
    row.text,
    row.type,
    row.changed_by,
    row.at,
    ...HISTORY_UPSERT_COLUMNS.map((column) => row[column]),
  ];
}

/** Statuts valides pour un filtre `IN (…)`, avec leurs placeholders. */
function statusFilter(statuses: readonly string[] | undefined): {
  clause: string;
  params: SqlParam[];
} {
  if (statuses === undefined || statuses.length === 0) return { clause: '', params: [] };
  const allowed = statuses.filter((status) => status.length > 0);
  if (allowed.length === 0) return { clause: '', params: [] };
  return {
    clause: ` AND status IN (${allowed.map(() => '?').join(', ')})`,
    params: [...allowed],
  };
}

export function createCriterionStore(sql: SqlClient): CriterionStore {
  const criterionColumns = selectColumns('criterion');
  const historyColumns = selectColumns('criterion_history');

  return {
    async listCriteriaByIssue(issueId, statuses): Promise<Criterion[]> {
      const filter = statusFilter(statuses);
      const rows = await sql.query<CriterionRow>(
        `SELECT ${criterionColumns} FROM criterion WHERE issue_id = ?${filter.clause}
         ORDER BY version DESC, code ASC, id ASC LIMIT ${CRITERIA_LIST_LIMIT}`,
        [issueId, ...filter.params],
      );
      return rows.map(rowToCriterion);
    },

    async getCriterion(criterionId): Promise<Criterion | null> {
      const rows = await sql.query<CriterionRow>(
        `SELECT ${criterionColumns} FROM criterion WHERE id = ? LIMIT 1`,
        [criterionId],
      );
      const row = rows[0];
      return row === undefined ? null : rowToCriterion(row);
    },

    async getCriterionByCode(issueId, code): Promise<Criterion | null> {
      const rows = await sql.query<CriterionRow>(
        `SELECT ${criterionColumns} FROM criterion WHERE issue_id = ? AND code = ?
         ORDER BY version DESC LIMIT 1`,
        [issueId, code],
      );
      const row = rows[0];
      return row === undefined ? null : rowToCriterion(row);
    },

    async saveCriterion(criterion): Promise<void> {
      const row = criterionToRow(criterion);
      await sql.execute(UPSERT_CRITERION, criterionValues(row));
    },

    async addCriterionRevision(revision): Promise<void> {
      const row = criterionRevisionToRow(revision);
      await sql.execute(UPSERT_HISTORY, historyValues(row));
    },

    async listCriterionRevisions(criterionId): Promise<CriterionRevision[]> {
      const rows = await sql.query<CriterionRevisionRow>(
        `SELECT ${historyColumns} FROM criterion_history WHERE criterion_id = ?
         ORDER BY version ASC LIMIT ${CRITERIA_LIST_LIMIT}`,
        [criterionId],
      );
      return rows.map(rowToCriterionRevision);
    },

    /**
     * Prochain code `AC-n` d'un ticket : lit les codes existants (borné) et
     * laisse le domaine trancher — la règle de calcul vit dans
     * `src/domain/criteria.ts`, pas en SQL (zéro duplication).
     */
    async nextCriterionCode(issueId): Promise<string> {
      const rows = await sql.query<Pick<CriterionRow, 'code'>>(
        `SELECT code FROM criterion WHERE issue_id = ? ORDER BY version DESC LIMIT ${CRITERIA_LIST_LIMIT}`,
        [issueId],
      );
      return nextCode(rows.map((row) => ({ code: String(row.code ?? '') })));
    },
  };
}
