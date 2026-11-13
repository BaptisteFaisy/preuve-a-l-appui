/**
 * Faux `WaiverStore`, `CoverageStore`, `SettingsStore` (SPEC §12, §18, §20).
 *
 * Règles respectées :
 * - aucune dérogation supprimée (`revokeWaiver` écrit `revokedAt`, garde la
 *   ligne ; une seconde révocation ne change rien et rend `false`, comme le
 *   ferait `UPDATE … WHERE revoked_at = ''`) ;
 * - `null` quand couverture ou réglages absents, jamais d'exception ;
 * - les listes par projet acceptent l'id de projet **ou** sa clé.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { CoverageStore, SettingsStore, WaiverStore } from '../../src/ports.js';
import {
  bounded,
  criterionIdsOfIssue,
  inProject,
  issueOfCriterion,
  type FakeStoreTables,
} from './fake-store-core.js';

export function waiverStore(tables: FakeStoreTables): WaiverStore {
  return {
    async listWaiversByCriterion(criterionId) {
      return bounded([...tables.waivers.values()].filter((row) => row.criterionId === criterionId));
    },

    async listWaiversByIssue(issueId) {
      const ids = criterionIdsOfIssue(tables, issueId);
      return bounded([...tables.waivers.values()].filter((row) => ids.has(row.criterionId)));
    },

    async listWaiversByProject(projectId, since) {
      const rows = [...tables.waivers.values()].filter((row) => {
        if (row.at < since) return false;
        const issueId = issueOfCriterion(tables, row.criterionId);
        return issueId !== null && inProject(tables, issueId, projectId);
      });
      return bounded(rows);
    },

    async saveWaiver(waiver) {
      tables.waivers.set(waiver.id, waiver);
    },

    async revokeWaiver(waiverId, at) {
      const existing = tables.waivers.get(waiverId);
      if (existing === undefined || existing.revokedAt !== '') return false;
      tables.waivers.set(waiverId, { ...existing, revokedAt: at });
      return true;
    },
  };
}

/**
 * Tickets clos hors validateur (SPEC §20) : pas de ligne de couverture, ou une
 * couverture qui ne passe pas. Un seul endroit, lu aussi par `computeStats`.
 */
export function closedWithoutCoverageIds(tables: FakeStoreTables, projectId: string): string[] {
  const ids: string[] = [];
  for (const [issueId, project] of tables.closedIssues) {
    if (project !== projectId && !inProject(tables, issueId, projectId)) continue;
    const coverage = tables.coverage.get(issueId);
    if (coverage === undefined || !coverage.passes) ids.push(issueId);
  }
  return ids;
}

export function coverageStore(tables: FakeStoreTables): CoverageStore {
  return {
    async getCoverage(issueId) {
      return tables.coverage.get(issueId) ?? null;
    },

    async saveCoverage(coverage) {
      tables.coverage.set(coverage.issueId, coverage);
    },

    async listClosedWithoutCoverage(projectId, limit) {
      return bounded(closedWithoutCoverageIds(tables, projectId), limit);
    },

    async listCoveragesByProject(projectKey) {
      return bounded(
        [...tables.coverage.values()].filter((coverage) =>
          inProject(tables, coverage.issueKey, projectKey),
        ),
      );
    },
  };
}

export function settingsStore(tables: FakeStoreTables): SettingsStore {
  return {
    async getSettings(projectId) {
      return tables.settings.get(projectId) ?? null;
    },

    async saveSettings(settings) {
      tables.settings.set(settings.projectId, settings);
    },

    async findProjectByCiKeyHash(hash) {
      if (hash === '') return null;
      for (const settings of tables.settings.values()) {
        if (settings.ciKeyHash === hash) return settings;
      }
      return null;
    },
  };
}
