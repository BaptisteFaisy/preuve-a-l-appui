/**
 * Adaptateur SQL de la preuve vivante (SPEC §7.5, §13, §18).
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md §4). La table `living_proof` porte
 * une colonne `project_id` que le type `LivingProof` n'a pas : elle est
 * déduite de la clé du ticket (`PAY-123` → `PAY`), et la lecture accepte
 * l'identifiant de projet **ou** sa clé — sinon l'écran projet (SPEC §13)
 * n'afficherait jamais rien.
 *
 * Aucun `DELETE` : un critère livré qui redevient prouvé est réécrit en
 * `proven`, la ligne reste (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { LivingStore } from '../ports';
import type { LivingProof } from '../types';
import { LIVING_STATES, parseEnum } from './mapping-common';
import { LIVING_PROOF_COLUMNS, livingProofToRow, rowToLivingProof, type LivingProofRow } from './mapping-living';
import { selectColumns } from './mapping';
import type { SqlClient, SqlParam } from './sql-client';

/** Borne de toute liste de preuves vivantes (SPEC §20 : rien d'infini). */
export const LIVING_LIST_LIMIT = 500;

const LIVING_UPSERT_COLUMNS = LIVING_PROOF_COLUMNS.filter((column) => column !== 'id');

const UPSERT_LIVING = `INSERT INTO living_proof (${LIVING_PROOF_COLUMNS.join(', ')})
  VALUES (${LIVING_PROOF_COLUMNS.map(() => '?').join(', ')})
  ON DUPLICATE KEY UPDATE ${LIVING_UPSERT_COLUMNS.map((column) => `${column} = VALUES(${column})`).join(', ')}`;

/** Clé projet déduite d'une clé de ticket : `PAY-123` → `PAY`. */
export function projectKeyOfIssue(issueKey: string): string {
  const dash = issueKey.lastIndexOf('-');
  return dash > 0 ? issueKey.slice(0, dash) : issueKey;
}

function livingValues(row: LivingProofRow): SqlParam[] {
  return [
    row.id,
    row.project_id,
    row.issue_key,
    row.criterion_id,
    row.test_name,
    row.state,
    row.component,
    row.commit,
    row.since,
  ];
}

/** Filtre d'état optionnel, avec son paramètre : jamais de SQL concaténé à la main. */
function stateFilter(state: string | undefined): { clause: string; params: SqlParam[] } {
  if (state === undefined || state.length === 0) return { clause: '', params: [] };
  return { clause: ' AND state = ?', params: [state] };
}

export function createLivingStore(sql: SqlClient): LivingStore {
  const columns = selectColumns('living_proof');

  return {
    /**
     * Preuves vivantes d'un projet, éventuellement filtrées par état.
     * `projectId` peut être l'identifiant (`10000`) ou la clé (`PAY`).
     */
    async listLivingByProject(projectId: string, state?: string): Promise<LivingProof[]> {
      const filter = stateFilter(state);
      const rows = await sql.query<LivingProofRow>(
        `SELECT ${columns} FROM living_proof WHERE (project_id = ? OR project_id = ?)${filter.clause}
         ORDER BY issue_key ASC, test_name ASC LIMIT ${LIVING_LIST_LIMIT}`,
        [projectId, projectKeyOfIssue(projectId), ...filter.params],
      );
      return rows.map(rowToLivingProof);
    },

    /** Les critères livrés qui ne sont plus prouvés (SPEC §13) : tout sauf `proven`. */
    async listUnprovenLiving(projectId: string): Promise<LivingProof[]> {
      const rows = await sql.query<LivingProofRow>(
        `SELECT ${columns} FROM living_proof
         WHERE (project_id = ? OR project_id = ?) AND state <> ?
         ORDER BY issue_key ASC, test_name ASC LIMIT ${LIVING_LIST_LIMIT}`,
        [projectId, projectKeyOfIssue(projectId), 'proven'],
      );
      return rows.map(rowToLivingProof);
    },

    /**
     * Écrit une preuve vivante. Le projet vient du contexte d'écriture : il est
     * déduit de la clé du ticket, faute de champ dans le type du domaine.
     */
    async saveLivingProof(proof: LivingProof): Promise<void> {
      const projectId = projectKeyOfIssue(proof.issueKey);
      const row = livingProofToRow({ ...proof, state: parseEnum(proof.state, LIVING_STATES, 'unproven') }, projectId);
      await sql.execute(UPSERT_LIVING, livingValues(row));
    },
  };
}
