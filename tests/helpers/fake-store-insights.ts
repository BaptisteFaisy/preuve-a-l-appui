/**
 * Faux `ReportingStore` : statistiques et dossier de preuve (SPEC §14, §17).
 *
 * Les statistiques sont **calculées** depuis les tables (couvertures,
 * dérogations, tickets clos) pour qu'un test voie bouger ses chiffres ;
 * `seedStats` permet de forcer un jeu exact. Les taux de réouverture ne
 * dépendent que de Jira, pas du store : ils restent vides.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReportingStore } from '../../src/ports.js';
import type { GranterCount, Strength } from '../../src/types.js';
import { bounded, inProject, issueOfCriterion, type FakeStoreTables } from './fake-store-core.js';
import { closedWithoutCoverageIds } from './fake-store-project.js';

function countProven(tables: FakeStoreTables, projectId: string): Record<Strength, number> {
  const counts: Record<Strength, number> = { declared: 0, attested: 0, 'machine-verified': 0 };
  for (const coverage of tables.coverage.values()) {
    if (!inProject(tables, coverage.issueId, projectId)) continue;
    for (const state of coverage.criteria) {
      if (!state.proven || state.bestStrength === null) continue;
      counts[state.bestStrength] += 1;
    }
  }
  return counts;
}

function countWaivers(tables: FakeStoreTables, projectId: string, since: string): GranterCount[] {
  const byGranter = new Map<string, number>();
  for (const waiver of tables.waivers.values()) {
    if (waiver.at < since || waiver.revokedAt !== '') continue;
    const issueId = issueOfCriterion(tables, waiver.criterionId);
    if (issueId === null || !inProject(tables, issueId, projectId)) continue;
    byGranter.set(waiver.grantedBy, (byGranter.get(waiver.grantedBy) ?? 0) + 1);
  }
  return [...byGranter.entries()].map(([accountId, count]) => ({
    accountId,
    displayName: accountId,
    count,
  }));
}

export function reportingStore(tables: FakeStoreTables): ReportingStore {
  return {
    async computeStats(projectId, since) {
      const seeded = tables.seededStats.get(projectId);
      if (seeded !== undefined) return seeded;
      return {
        projectId,
        since,
        coverageByStrength: countProven(tables, projectId),
        waiversByGranter: bounded(countWaivers(tables, projectId, since)),
        closedWithoutValidator: closedWithoutCoverageIds(tables, projectId).length,
        reopenings: [],
      };
    },

    async getDossier(versionId) {
      return tables.dossiers.get(versionId) ?? null;
    },

    async saveDossier(dossier) {
      tables.dossiers.set(dossier.versionId, dossier);
    },
  };
}
