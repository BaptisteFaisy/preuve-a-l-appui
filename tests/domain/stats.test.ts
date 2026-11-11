/**
 * Tests du domaine : statistiques de couverture, réouvertures et dérogations (SPEC §14 FP-18).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateCoverageByStrength,
  aggregateWaiversByGranter,
  buildProofStats,
  collectStats,
  emptyCoverageByStrength,
  provenCriteria,
  reopeningRates,
  reopeningShare,
  type StatsDeps,
} from '../../src/domain/stats.js';
import {
  aCoverage,
  aCriterion,
  aCriterionState,
  aWaiver,
  ISSUE_ID,
  PROJECT_ID,
} from '../helpers/builders.js';
import { createFakeClock } from '../helpers/fake-clock.js';
import { createFakeJira } from '../helpers/fake-gateways.js';
import { createFakeStore, type FakeStore } from '../helpers/fake-store.js';

const SINCE = '2026-11-01T00:00:00.000Z';

function statsDeps(store: FakeStore, names: Record<string, string> = {}): StatsDeps {
  return {
    store,
    jira: createFakeJira([], { displayNames: names }),
    clock: createFakeClock(),
  };
}

describe('stats — couverture par force de preuve (SPEC §14 FP-18)', () => {
  it('donne des compteurs à zéro sans ticket', () => {
    expect(emptyCoverageByStrength()).toEqual({ declared: 0, attested: 0, 'machine-verified': 0 });
    expect(aggregateCoverageByStrength([])).toEqual(emptyCoverageByStrength());
  });

  it('répartit les critères prouvés selon la meilleure force obtenue', () => {
    const coverages = [
      aCoverage({
        criteria: [
          aCriterionState({ proven: true, bestStrength: 'machine-verified' }),
          aCriterionState({ criterionId: 'crit-2', proven: true, bestStrength: 'attested' }),
          aCriterionState({ criterionId: 'crit-3', proven: true, bestStrength: 'declared' }),
          aCriterionState({ criterionId: 'crit-4', proven: false, bestStrength: null }),
        ],
      }),
      aCoverage({
        issueId: '10002',
        criteria: [
          aCriterionState({ criterionId: 'crit-5', proven: true, bestStrength: 'machine-verified' }),
        ],
      }),
    ];

    const counts = aggregateCoverageByStrength(coverages);

    expect(counts['machine-verified']).toBe(2);
    expect(counts.attested).toBe(1);
    expect(counts.declared).toBe(1);
  });

  it('compte le total des critères prouvés', () => {
    const coverages = [
      aCoverage({ proven: 3, total: 4 }),
      aCoverage({ issueId: '10002', proven: 2, total: 2 }),
    ];
    expect(provenCriteria(coverages)).toBe(5);
  });
});

describe('stats — dérogations par personne (SPEC §12.4, FP-18)', () => {
  it('classe les signataires par nombre décroissant de dérogations', () => {
    const waivers = [
      aWaiver({ id: 'w1', grantedBy: 'user-po', at: '2026-11-05T00:00:00.000Z' }),
      aWaiver({ id: 'w2', grantedBy: 'user-po', at: '2026-11-06T00:00:00.000Z' }),
      aWaiver({ id: 'w3', grantedBy: 'user-lead', at: '2026-11-07T00:00:00.000Z' }),
    ];

    const counts = aggregateWaiversByGranter(waivers, SINCE);

    expect(counts).toHaveLength(2);
    expect(counts[0]?.accountId).toBe('user-po');
    expect(counts[0]?.count).toBe(2);
    expect(counts[1]?.accountId).toBe('user-lead');
    expect(counts[1]?.count).toBe(1);
  });

  it('ignore les dérogations révoquées et les dérogations trop anciennes', () => {
    const waivers = [
      aWaiver({ id: 'w1', grantedBy: 'user-po', at: '2026-11-05T00:00:00.000Z', revokedAt: '2026-11-08T00:00:00.000Z' }),
      aWaiver({ id: 'w2', grantedBy: 'user-po', at: '2026-10-15T00:00:00.000Z' }),
      aWaiver({ id: 'w3', grantedBy: 'user-po', at: '2026-11-06T00:00:00.000Z' }),
    ];

    const counts = aggregateWaiversByGranter(waivers, SINCE);

    expect(counts).toHaveLength(1);
    expect(counts[0]?.count).toBe(1);
  });
});

describe('stats — réouvertures selon la force (SPEC §14 FP-18)', () => {
  it('calcule le taux de réouverture pour chaque force dans l’ordre', () => {
    const rates = reopeningRates([
      { strength: 'machine-verified', reopened: false },
      { strength: 'machine-verified', reopened: false },
      { strength: 'attested', reopened: false },
      { strength: 'attested', reopened: true },
      { strength: 'declared', reopened: true },
      { strength: 'declared', reopened: true },
    ]);

    expect(rates.map((rate) => rate.strength)).toEqual(['machine-verified', 'attested', 'declared']);
    expect(rates[0]).toEqual({ strength: 'machine-verified', closed: 2, reopened: 0 });
    expect(rates[1]).toEqual({ strength: 'attested', closed: 2, reopened: 1 });
    expect(rates[2]).toEqual({ strength: 'declared', closed: 2, reopened: 2 });
    expect(reopeningShare(rates[1]!)).toBe(50);
    expect(reopeningShare(rates[2]!)).toBe(100);
    expect(reopeningShare({ strength: 'declared', closed: 0, reopened: 0 })).toBe(0);
  });
});

describe('stats — assemblage et collecte (SPEC §14 FP-18)', () => {
  it('assemble un objet complet sans appel externe', () => {
    const stats = buildProofStats({
      projectId: PROJECT_ID,
      since: SINCE,
      coverages: [aCoverage({ criteria: [aCriterionState({ proven: true, bestStrength: 'declared' })] })],
      waivers: [aWaiver({ grantedBy: 'user-po', at: '2026-11-05T00:00:00.000Z' })],
      closedWithoutValidator: 1,
    });

    expect(stats.projectId).toBe(PROJECT_ID);
    expect(stats.closedWithoutValidator).toBe(1);
    expect(stats.coverageByStrength.declared).toBe(1);
    expect(stats.waiversByGranter[0]?.accountId).toBe('user-po');
    expect(stats.reopenings).toHaveLength(3);
  });

  it('résout les noms d’affichage Jira lors de la collecte', async () => {
    const store = createFakeStore();
    store.linkIssue(ISSUE_ID, PROJECT_ID);
    await store.saveCriterion(aCriterion({ id: 'crit-1', issueId: ISSUE_ID }));
    await store.saveCoverage(aCoverage({ criteria: [aCriterionState({ proven: true, bestStrength: 'attested' })] }));
    await store.saveWaiver(aWaiver({ grantedBy: 'user-po', at: '2026-11-05T00:00:00.000Z' }));

    const stats = await collectStats(statsDeps(store, { 'user-po': 'Sam PO' }), PROJECT_ID, SINCE);

    expect(stats.waiversByGranter[0]?.displayName).toBe('Sam PO');
  });
});
