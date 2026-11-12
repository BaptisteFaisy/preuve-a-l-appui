/**
 * Adaptateur SQL : agrégats statistiques et dossier de preuve (SPEC §14 FP-17, FP-18, §18).
 *
 * Propriétaire : lot L7. Lecture seule pour les statistiques ; la table
 * `release_dossier` est la seule écrite ici (instantané figé, SPEC §17).
 *
 * Deux contraintes du schéma guident les requêtes :
 * - aucune table ne porte `project_id` sauf `settings` : le seul discriminant
 *   de projet disponible pour les agrégats est le préfixe de `issue_key`
 *   (`PAY-123` → projet `PAY`). `computeStats` filtre donc par clé de projet ;
 * - `waiver` ne connaît que `criterion_id` : le rattachement au projet passe
 *   par `criterion.issue_id` puis `coverage.issue_key` (la table coverage est
 *   la seule à faire le lien id ↔ clé).
 *
 * Invariants : requêtes bornées (WHERE + LIMIT), écritures rejouables
 * (upsert), lectures sans exception (ligne absente → `null`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient, SqlParam } from './sql-client';
import type { ReportingStore } from '../ports';
import type { Coverage, ProofStats, ReleaseDossier, Waiver } from '../types';
import { selectColumns } from './mapping';
import {
  RELEASE_DOSSIER_COLUMNS,
  releaseDossierToRow,
  rowToReleaseDossier,
  type ReleaseDossierRow,
} from './mapping-living';
import { rowToCoverage, type CoverageRow } from './mapping-coverage';
import { rowToWaiver, type WaiverRow } from './mapping-evidence';
import { toTimestamp } from './mapping-common';
import { aggregateCoverageByStrength, aggregateWaiversByGranter } from '../domain/stats';

/** Borne de toute liste d'agrégats (SPEC §18 : aucune liste infinie). */
export const REPORTING_LIST_LIMIT = 500;

const DOSSIER_UPSERT_COLUMNS = RELEASE_DOSSIER_COLUMNS.filter((col) => col !== 'version_id');

function buildUpsertDossier(): string {
  const placeholders = RELEASE_DOSSIER_COLUMNS.map(() => '?').join(', ');
  const updates = DOSSIER_UPSERT_COLUMNS.map((col) => `${col} = VALUES(${col})`).join(', ');
  return `INSERT INTO release_dossier (${RELEASE_DOSSIER_COLUMNS.join(', ')}) VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates}`;
}

const UPSERT_DOSSIER = buildUpsertDossier();

function dossierValues(row: ReleaseDossierRow): SqlParam[] {
  return [
    row.version_id,
    row.version_name,
    row.project_key,
    row.generated_at,
    row.issues_json,
    row.totals_json,
    ...DOSSIER_UPSERT_COLUMNS.map((col) => row[col]),
  ];
}

/** Couvertures du projet : préfixe de `issue_key` (seul discriminant available). */
async function loadProjectCoverages(sql: SqlClient, projectKey: string): Promise<Coverage[]> {
  const rows = await sql.query<CoverageRow>(
    `SELECT ${selectColumns('coverage')} FROM coverage WHERE issue_key LIKE ?
     ORDER BY updated_at DESC LIMIT ${REPORTING_LIST_LIMIT}`,
    [`${projectKey}-%`],
  );
  return rows.map(rowToCoverage);
}

/** Dérogations du projet depuis `since`, via criterion → coverage (id ↔ clé). */
async function loadProjectWaivers(
  sql: SqlClient,
  projectKey: string,
  since: string,
): Promise<Waiver[]> {
  const rows = await sql.query<WaiverRow>(
    `SELECT ${selectColumns('waiver')} FROM waiver
     WHERE at >= ? AND criterion_id IN (
       SELECT c.id FROM criterion c WHERE c.issue_id IN (
         SELECT cov.issue_id FROM coverage cov WHERE cov.issue_key LIKE ?
       )
     )
     ORDER BY at DESC LIMIT ${REPORTING_LIST_LIMIT}`,
    [toTimestamp(since) ?? '', `${projectKey}-%`],
  );
  return rows.map(rowToWaiver);
}

/**
 * Tickets dont la dernière couverture ne passe pas le validateur (SPEC §20 :
 * « l'app dit ce qu'elle bloque et ce qu'elle ne bloque pas »). Le statut
 * « clos » vit dans Jira, pas dans le schéma : le contrôle nocturne (lot L3)
 * compare cette liste aux clôtures réelles.
 */
async function countNotPassing(sql: SqlClient, projectKey: string): Promise<number> {
  const rows = await sql.query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM coverage WHERE issue_key LIKE ? AND passes = 0 LIMIT 1`,
    [`${projectKey}-%`],
  );
  const first = rows[0];
  return first === undefined ? 0 : Number(first.n ?? 0) || 0;
}

export function createReportingStore(sql: SqlClient): ReportingStore {
  return {
    async computeStats(projectId: string, since: string): Promise<ProofStats> {
      const coverages = await loadProjectCoverages(sql, projectId);
      const waivers = await loadProjectWaivers(sql, projectId, since);
      return {
        projectId,
        since,
        coverageByStrength: aggregateCoverageByStrength(coverages),
        waiversByGranter: aggregateWaiversByGranter(waivers, since),
        closedWithoutValidator: await countNotPassing(sql, projectId),
        // Les réouvertures viennent du changelog Jira, pas du schéma SQL :
        // l'agrégat reste vide ici, comme dans le faux store partagé.
        reopenings: [],
      };
    },

    async getDossier(versionId: string): Promise<ReleaseDossier | null> {
      const rows = await sql.query<ReleaseDossierRow>(
        `SELECT ${selectColumns('release_dossier')} FROM release_dossier
         WHERE version_id = ? LIMIT 1`,
        [versionId],
      );
      const row = rows[0];
      return row === undefined ? null : rowToReleaseDossier(row);
    },

    async saveDossier(dossier: ReleaseDossier): Promise<void> {
      const row = releaseDossierToRow(dossier);
      await sql.execute(UPSERT_DOSSIER, dossierValues(row));
    },
  };
}
