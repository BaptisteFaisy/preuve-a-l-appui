/**
 * Faux `TestRunStore`, `TestLinkStore`, `LivingStore` (SPEC §10, §11, §13).
 *
 * - les pipelines sont gardés dans l'ordre d'arrivée ; `latestRunForBranch`
 *   retient le dernier par `receivedAt`, départagé par l'ordre d'écriture ;
 * - une paire test ↔ critère proposée ne compte jamais comme preuve : seul
 *   `confirmed` est retenu par `listConfirmedLinksByTest` (SPEC §11) ;
 * - une preuve vivante est « non prouvée » dès qu'elle n'est plus `proven`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { LivingStore, TestLinkStore, TestRunStore } from '../../src/ports.js';
import type { TestRun } from '../../src/types.js';
import {
  bounded,
  criterionIdsOfIssue,
  inProject,
  projectKeyOf,
  type FakeStoreTables,
} from './fake-store-core.js';

function latestRun(tables: FakeStoreTables, repo: string, branch: string): TestRun | null {
  let best: TestRun | null = null;
  for (const run of tables.runs.values()) {
    if (run.repo !== repo || run.branch !== branch) continue;
    if (best === null || run.receivedAt >= best.receivedAt) best = run;
  }
  return best;
}

export function testRunStore(tables: FakeStoreTables): TestRunStore {
  return {
    async saveTestRun(run) {
      tables.runs.set(run.id, run);
    },

    async getTestRun(runId) {
      return tables.runs.get(runId) ?? null;
    },

    async addTestResults(runId, outcomes) {
      const existing = tables.results.get(runId) ?? [];
      tables.results.set(runId, [...existing, ...outcomes]);
      return outcomes.length;
    },

    async listTestResults(runId) {
      return bounded(tables.results.get(runId) ?? []);
    },

    async latestRunForBranch(repo, branch) {
      return latestRun(tables, repo, branch);
    },

    async latestOutcomesForBranch(repo, branch) {
      const run = latestRun(tables, repo, branch);
      if (run === null) return [];
      return bounded(tables.results.get(run.id) ?? []);
    },
  };
}

export function testLinkStore(tables: FakeStoreTables): TestLinkStore {
  return {
    async listLinksByCriterion(criterionId) {
      return bounded([...tables.links.values()].filter((row) => row.criterionId === criterionId));
    },

    async listConfirmedLinksByTest(testName) {
      return bounded(
        [...tables.links.values()].filter(
          (row) => row.testName === testName && row.status === 'confirmed',
        ),
      );
    },

    async listProposedLinks(issueId) {
      const ids = criterionIdsOfIssue(tables, issueId);
      return bounded(
        [...tables.links.values()].filter(
          (row) => row.status === 'proposed' && ids.has(row.criterionId),
        ),
      );
    },

    async saveLink(link) {
      tables.links.set(link.id, link);
    },
  };
}

export function livingStore(tables: FakeStoreTables): LivingStore {
  // Les preuves vivantes sont lues par la CLÉ du projet (la vraie table
  // `living_proof` la porte) ; l'id numérique marche aussi via le lien ticket.
  const inProjectOrKey = (issueKey: string, projectId: string): boolean =>
    inProject(tables, issueKey, projectId) ||
    projectKeyOf(issueKey) === projectKeyOf(projectId);
  return {
    async listLivingByProject(projectId, state) {
      return bounded(
        [...tables.living.values()].filter(
          (row) =>
            inProjectOrKey(row.issueKey, projectId) &&
            (state === undefined || row.state === state),
        ),
      );
    },

    async listUnprovenLiving(projectId) {
      return bounded(
        [...tables.living.values()].filter(
          (row) => inProjectOrKey(row.issueKey, projectId) && row.state !== 'proven',
        ),
      );
    },

    async saveLivingProof(proof) {
      tables.living.set(proof.id, proof);
    },
  };
}
