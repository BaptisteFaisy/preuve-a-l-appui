/**
 * Adaptateur `EvidenceStore` — tables `evidence` et `attestation` (SPEC §18).
 *
 * Lot L2 (docs/CONTRACTS.md §4). Remplace la souche du socle par un vrai
 * adaptateur `SqlClient`, dans le respect des règles dures :
 * - aucune requête sans `WHERE`, aucune liste sans `LIMIT` (CONTRACTS §4) ;
 * - écritures rejouables : `INSERT … ON DUPLICATE KEY UPDATE`, jamais de
 *   suppression (SPEC §20 — une preuve est remplacée, pas ôtée) ;
 * - paramètres positionnels `?` dans l'ordre de `EVIDENCE_COLUMNS` /
 *   `ATTESTATION_COLUMNS` (mapping gelé, mots réservés requotés) ;
 * - `listEvidencesByIssue` lit d'abord les critères du ticket puis les
 *   preuves par identifiant : pas de sous-requête (SQL Forge minimal).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient, SqlParam } from './sql-client.js';
import type { EvidenceStore } from '../ports.js';
import type { Attestation, Evidence } from '../types.js';
import {
  ATTESTATION_COLUMNS,
  attestationToRow,
  EVIDENCE_COLUMNS,
  evidenceToRow,
  insertPlaceholders,
  rowToAttestation,
  rowToEvidence,
  selectColumns,
  type AttestationRow,
  type EvidenceRow,
} from './mapping.js';

/** Borne de toute liste (CONTRACTS §4 : aucune liste sans LIMIT). */
export const EVIDENCE_LIST_LIMIT = 500;

/** Colonnes réservées MySQL/TiDB, à requoter hors du SELECT déjà coté. */
const RESERVED = new Set(['commit', 'reference']);

function quote(column: string): string {
  return RESERVED.has(column) ? `\`${column}\`` : column;
}

/** `col = VALUES(col)` pour chaque colonne hors clé primaire : l'upsert idempotent. */
function duplicateKeyAssigns(columns: readonly string[]): string {
  return columns
    .filter((column) => column !== 'id')
    .map((column) => `${quote(column)} = VALUES(${quote(column)})`)
    .join(', ');
}

function insertStatement(table: 'evidence' | 'attestation', columns: readonly string[]): string {
  return `INSERT INTO ${table} (${selectColumns(table)}) VALUES (${insertPlaceholders(table)})
    ON DUPLICATE KEY UPDATE ${duplicateKeyAssigns(columns)}`;
}

/** Paramètres d'insertion dans l'ordre exact des colonnes du mapping gelé. */
function rowParams<Row>(row: Row, columns: readonly (keyof Row)[]): SqlParam[] {
  return columns.map((column) => row[column] as SqlParam);
}

function selectEvidence(where: string, order: string): string {
  return `SELECT ${selectColumns('evidence')} FROM evidence WHERE ${where} ORDER BY ${order} LIMIT ${EVIDENCE_LIST_LIMIT}`;
}

export function createEvidenceStore(sql: SqlClient): EvidenceStore {
  const evidenceInsert = insertStatement('evidence', EVIDENCE_COLUMNS);
  const attestationInsert = insertStatement('attestation', ATTESTATION_COLUMNS);

  async function criterionIdsOfIssue(issueId: string): Promise<string[]> {
    const rows = await sql.query<{ id: string }>(
      `SELECT id FROM criterion WHERE issue_id = ? LIMIT ${EVIDENCE_LIST_LIMIT}`,
      [issueId],
    );
    return rows.map((row) => row.id).filter((id) => id !== '');
  }

  return {
    async listEvidencesByCriterion(criterionId: string): Promise<Evidence[]> {
      const rows = await sql.query<EvidenceRow>(
        selectEvidence('criterion_id = ?', 'at ASC, id ASC'),
        [criterionId],
      );
      return rows.map(rowToEvidence);
    },

    async listEvidencesByIssue(issueId: string): Promise<Evidence[]> {
      const ids = await criterionIdsOfIssue(issueId);
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(', ');
      const rows = await sql.query<EvidenceRow>(
        selectEvidence(`criterion_id IN (${placeholders})`, 'at ASC, id ASC'),
        ids,
      );
      return rows.map(rowToEvidence);
    },

    async listEvidencesByTestName(testName: string): Promise<Evidence[]> {
      const rows = await sql.query<EvidenceRow>(
        selectEvidence("type = 'test' AND `reference` = ?", 'at ASC, id ASC'),
        [testName],
      );
      return rows.map(rowToEvidence);
    },

    async getEvidence(evidenceId: string): Promise<Evidence | null> {
      const rows = await sql.query<EvidenceRow>(
        `SELECT ${selectColumns('evidence')} FROM evidence WHERE id = ? LIMIT 1`,
        [evidenceId],
      );
      const row = rows[0];
      return row ? rowToEvidence(row) : null;
    },

    async saveEvidence(evidence: Evidence): Promise<void> {
      const params = rowParams(evidenceToRow(evidence), EVIDENCE_COLUMNS);
      await sql.execute(evidenceInsert, params);
    },

    async addAttestation(attestation: Attestation): Promise<void> {
      const params = rowParams(attestationToRow(attestation), ATTESTATION_COLUMNS);
      await sql.execute(attestationInsert, params);
    },

    async listAttestations(criterionId: string): Promise<Attestation[]> {
      const rows = await sql.query<AttestationRow>(
        `SELECT ${selectColumns('attestation')} FROM attestation
         WHERE criterion_id = ? ORDER BY at ASC, id ASC LIMIT ${EVIDENCE_LIST_LIMIT}`,
        [criterionId],
      );
      return rows.map(rowToAttestation);
    },

    async markEvidencesToReconfirm(criterionId: string, fromVersion: number): Promise<number> {
      return sql.execute(
        `UPDATE evidence SET freshness = 'to-reconfirm'
         WHERE criterion_id = ? AND criterion_version < ? AND freshness = 'fresh'
         LIMIT ${EVIDENCE_LIST_LIMIT}`,
        [criterionId, fromVersion],
      );
    },
  };
}
