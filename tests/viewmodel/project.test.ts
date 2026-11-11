/**
 * Tests du view-model de la page projet (SPEC §16.4, §13, §14).
 *
 * Vérifie la liste des preuves vivantes non prouvées, le comptage des
 * dérogations actives (hors révoquées), l’agrégation des tickets et le
 * formatage des statistiques. Logique pure.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  aCoverage,
  aLivingProof,
  aWaiver,
  PROJECT_ID,
} from '../../tests/helpers/builders.js';
import type { ProofStats } from '../../src/types.js';
import { buildProjectPageViewModel } from '../../src/viewmodel/project.js';

function sampleStats(partial: Partial<ProofStats> = {}): ProofStats {
  return {
    projectId: PROJECT_ID,
    since: '1970-01-01T00:00:00.000Z',
    coverageByStrength: { 'machine-verified': 5, attested: 3, declared: 1 },
    waiversByGranter: [{ accountId: 'user-po', displayName: 'Sam PO', count: 2 }],
    closedWithoutValidator: 4,
    reopenings: [],
    ...partial,
  };
}

describe('buildProjectPageViewModel', () => {
  it('agrège les tickets en cours avec leur couverture', () => {
    const vm = buildProjectPageViewModel({
      projectId: PROJECT_ID,
      coverages: [aCoverage({ issueKey: 'PAY-1', proven: 2, total: 3 }), aCoverage({ issueKey: 'PAY-2', proven: 3, total: 3, passes: true })],
      waivers: [],
      living: [],
      stats: null,
      language: 'fr',
    });
    expect(vm.issues).toHaveLength(2);
    expect(vm.issues[0]?.coverage.label).toBe('2 / 3');
    expect(vm.issues[1]?.passes).toBe(true);
  });

  it('compte les dérogations actives en excluant les révoquées', () => {
    const vm = buildProjectPageViewModel({
      projectId: PROJECT_ID,
      coverages: [],
      waivers: [aWaiver({ id: 'wv-1' }), aWaiver({ id: 'wv-2', revokedAt: '2026-11-11T09:00:00.000Z' })],
      living: [],
      stats: null,
      language: 'fr',
    });
    expect(vm.waivers).toHaveLength(2);
    expect(vm.activeWaiversCount).toBe(1);
  });

  it('ne retient que les preuves vivantes non prouvées', () => {
    const vm = buildProjectPageViewModel({
      projectId: PROJECT_ID,
      coverages: [],
      waivers: [],
      living: [
        aLivingProof({ id: 'lp-1', state: 'proven' }),
        aLivingProof({ id: 'lp-2', state: 'regressed' }),
        aLivingProof({ id: 'lp-3', state: 'unproven' }),
      ],
      stats: null,
      language: 'en',
    });
    expect(vm.unprovenLiving).toHaveLength(2);
    expect(vm.unprovenLivingCount).toBe(2);
    expect(vm.unprovenLiving.map((l) => l.id)).toEqual(['lp-2', 'lp-3']);
  });

  it('formate les statistiques de couverture par force', () => {
    const vm = buildProjectPageViewModel({
      projectId: PROJECT_ID,
      coverages: [],
      waivers: [],
      living: [],
      stats: sampleStats(),
      language: 'fr',
    });
    expect(vm.stats).not.toBeNull();
    const mv = vm.stats?.proofsByStrength.find((s) => s.strength === 'machine-verified');
    expect(mv?.count).toBe(5);
    expect(mv?.strengthLabel).toBe('Vérifié par machine');
    expect(vm.stats?.closedWithoutValidator).toBe(4);
    expect(vm.stats?.waiversByGranter[0]?.displayName).toBe('Sam PO');
  });

  it('rend des statistiques nulles quand absentes', () => {
    const vm = buildProjectPageViewModel({
      projectId: PROJECT_ID,
      coverages: [],
      waivers: [],
      living: [],
      stats: null,
      language: 'en',
    });
    expect(vm.stats).toBeNull();
  });
});
