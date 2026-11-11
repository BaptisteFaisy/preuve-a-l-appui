/**
 * Tests du domaine : preuve vivante sur la branche principale (SPEC §7.5, §13).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { evaluateLivingProofs, livingStateOfTest, type TrackedLivingItem } from '../../src/domain/living.js';
import { aLivingProof, aTestOutcome, COMMIT, ISSUE_KEY, TEST_LOG, TEST_REFUSAL } from '../helpers/builders.js';
import { createFakeIds } from '../helpers/fake-clock.js';

describe('livingStateOfTest', () => {
  it('traduit les états de test vers la preuve vivante', () => {
    expect(livingStateOfTest('passed')).toBe('proven');
    expect(livingStateOfTest('failed')).toBe('regressed');
    expect(livingStateOfTest('skipped')).toBe('unproven');
    expect(livingStateOfTest('absent')).toBe('unproven');
    expect(livingStateOfTest(undefined)).toBe('unproven');
  });
});

describe('evaluateLivingProofs', () => {
  const ids = createFakeIds('lp');
  const now = '2026-11-11T12:00:00.000Z';

  it('un test qui passe maintient l’état proven sans alerte', () => {
    const item: TrackedLivingItem = {
      existing: aLivingProof({ state: 'proven' }),
      issueKey: ISSUE_KEY,
      criterionId: 'crit-1',
      testName: TEST_REFUSAL,
      component: 'checkout',
    };
    const outcomes = [aTestOutcome({ name: TEST_REFUSAL, state: 'passed' })];

    const result = evaluateLivingProofs([item], outcomes, COMMIT, now, ids);

    expect(result.alerts).toHaveLength(0);
    expect(result.updated).toHaveLength(0); // déjà proven, inchangé
  });

  it('un test qui échoue passe en regressed et déclenche une alerte', () => {
    const item: TrackedLivingItem = {
      existing: aLivingProof({ state: 'proven' }),
      issueKey: ISSUE_KEY,
      criterionId: 'crit-1',
      testName: TEST_REFUSAL,
      component: 'checkout',
    };
    const outcomes = [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })];

    const result = evaluateLivingProofs([item], outcomes, COMMIT, now, ids);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].proof.state).toBe('regressed');
    expect(result.alerts[0].issueKey).toBe(ISSUE_KEY);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].state).toBe('regressed');
    expect(result.updated[0].commit).toBe(COMMIT);
  });

  it('un test absent ou ignoré alors qu’il existait passe en unproven (SPEC §13)', () => {
    const item: TrackedLivingItem = {
      existing: aLivingProof({ state: 'proven' }),
      issueKey: ISSUE_KEY,
      criterionId: 'crit-1',
      testName: TEST_REFUSAL,
      component: 'checkout',
    };
    // Le run sur main n'exécute que TEST_LOG : TEST_REFUSAL est absent
    const outcomes = [aTestOutcome({ name: TEST_LOG, state: 'passed' })];

    const result = evaluateLivingProofs([item], outcomes, COMMIT, now, ids);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].proof.state).toBe('unproven');
    expect(result.updated[0].state).toBe('unproven');
  });

  it('n’émet pas d’alerte doublon si l’état ne change pas', () => {
    const item: TrackedLivingItem = {
      existing: aLivingProof({ state: 'unproven' }),
      issueKey: ISSUE_KEY,
      criterionId: 'crit-1',
      testName: TEST_REFUSAL,
      component: 'checkout',
    };
    const outcomes = [aTestOutcome({ name: TEST_REFUSAL, state: 'skipped' })];

    const result = evaluateLivingProofs([item], outcomes, COMMIT, now, ids);

    expect(result.alerts).toHaveLength(0);
  });

  it('crée une nouvelle preuve vivante pour un lien confirmé sans historique', () => {
    const item: TrackedLivingItem = {
      issueKey: ISSUE_KEY,
      criterionId: 'crit-2',
      testName: TEST_LOG,
      component: 'checkout',
    };
    const outcomes = [aTestOutcome({ name: TEST_LOG, state: 'failed' })];

    const result = evaluateLivingProofs([item], outcomes, COMMIT, now, ids);

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].id).toBe('lp_1');
    expect(result.updated[0].state).toBe('regressed');
    expect(result.alerts).toHaveLength(1);
  });
});
