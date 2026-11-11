/**
 * Tests du domaine : fraîcheur des preuves de test (SPEC §9.3, §21).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCiSummaryToEvidences,
  extractIssueKeyFromBranch,
} from '../../src/domain/freshness.js';
import { aCiSummary, anEvidence, aTestOutcome, COMMIT, TEST_LOG, TEST_REFUSAL } from '../helpers/builders.js';
import { createFakeIds } from '../helpers/fake-clock.js';

describe('extractIssueKeyFromBranch', () => {
  it('extrait la clé PAY-123 de diverses formes de nom de branche', () => {
    expect(extractIssueKeyFromBranch('feature/PAY-123-email')).toBe('PAY-123');
    expect(extractIssueKeyFromBranch('PAY-123')).toBe('PAY-123');
    expect(extractIssueKeyFromBranch('bugfix/pay-123_refusal')).toBe('PAY-123');
    expect(extractIssueKeyFromBranch('PROJ_A-42-patch')).toBe('PROJ_A-42');
  });

  it('rend null si aucune clé de ticket n’apparaît dans la branche', () => {
    expect(extractIssueKeyFromBranch('main')).toBeNull();
    expect(extractIssueKeyFromBranch('develop')).toBeNull();
    expect(extractIssueKeyFromBranch('chore/clean-logs')).toBeNull();
  });
});

describe('applyCiSummaryToEvidences', () => {
  const ids = createFakeIds('ev');
  const now = '2026-11-11T10:00:00.000Z';

  it('un test passé produit une preuve fraîche machine-verified', () => {
    const existing = anEvidence({
      id: 'ev-old',
      reference: TEST_REFUSAL,
      strength: 'declared',
      verified: false,
      commit: 'old-commit',
    });
    const summary = aCiSummary({
      commit: COMMIT,
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'passed' })],
    });

    const update = applyCiSummaryToEvidences([existing], summary, ids, now);

    expect(update.updatedCount).toBe(1);
    expect(update.toSave).toHaveLength(2);
    const [archived, fresh] = update.toSave;
    expect(archived.freshness).toBe('stale');
    expect(archived.replacedBy).toBe(fresh.id);
    expect(fresh.strength).toBe('machine-verified');
    expect(fresh.verified).toBe(true);
    expect(fresh.freshness).toBe('fresh');
    expect(fresh.commit).toBe(COMMIT);
  });

  it('un test échoué ou ignoré dégrade la preuve en non valable', () => {
    const existing = anEvidence({
      id: 'ev-old',
      reference: TEST_REFUSAL,
      strength: 'machine-verified',
      verified: true,
      commit: 'old-commit',
    });
    const summary = aCiSummary({
      commit: COMMIT,
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })],
    });

    const update = applyCiSummaryToEvidences([existing], summary, ids, now);

    expect(update.updatedCount).toBe(1);
    const fresh = update.toSave[1];
    expect(fresh.strength).toBe('declared');
    expect(fresh.verified).toBe(false);
  });

  it('un test absent sur un nouveau commit passe à to-reconfirm (SPEC §9.3)', () => {
    const existing = anEvidence({
      id: 'ev-1',
      reference: TEST_REFUSAL,
      commit: 'old-commit',
      freshness: 'fresh',
    });
    const summary = aCiSummary({
      commit: 'new-commit',
      tests: [aTestOutcome({ name: TEST_LOG, state: 'passed' })],
    });

    const update = applyCiSummaryToEvidences([existing], summary, ids, now);

    expect(update.reconfirmCount).toBe(1);
    expect(update.toSave).toHaveLength(1);
    expect(update.toSave[0].freshness).toBe('to-reconfirm');
  });

  it('un pipeline rouge sur un autre test ne touche que les tests concernés (SPEC §21)', () => {
    const ev1 = anEvidence({
      id: 'ev-1',
      reference: TEST_REFUSAL,
      strength: 'machine-verified',
      verified: true,
      commit: COMMIT,
      freshness: 'fresh',
    });
    const ev2 = anEvidence({
      id: 'ev-2',
      reference: TEST_LOG,
      strength: 'machine-verified',
      verified: true,
      commit: COMMIT,
      freshness: 'fresh',
    });
    const summary = aCiSummary({
      commit: COMMIT,
      tests: [
        aTestOutcome({ name: TEST_REFUSAL, state: 'passed' }),
        aTestOutcome({ name: TEST_LOG, state: 'failed' }),
      ],
    });

    const update = applyCiSummaryToEvidences([ev1, ev2], summary, ids, now);

    // ev1 était déjà machine-verified sur ce commit : inchangé
    // ev2 a échoué : remplacé
    expect(update.updatedCount).toBe(1);
    expect(update.toSave.some((e) => e.reference === TEST_REFUSAL)).toBe(false);
    expect(update.toSave.some((e) => e.reference === TEST_LOG)).toBe(true);
  });

  it('un test ignoré dégrade la preuve, comme un test absent du résumé', () => {
    const existing = anEvidence({
      id: 'ev-skip',
      reference: TEST_REFUSAL,
      strength: 'machine-verified',
      verified: true,
      commit: 'old-commit',
    });
    const skipped = aCiSummary({
      commit: COMMIT,
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'skipped' })],
    });
    const declaredAbsent = aCiSummary({
      commit: COMMIT,
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'absent' })],
    });

    const fromSkipped = applyCiSummaryToEvidences([existing], skipped, ids, now);
    const fromAbsent = applyCiSummaryToEvidences([existing], declaredAbsent, ids, now);

    expect(fromSkipped.toSave[1].strength).toBe('declared');
    expect(fromSkipped.toSave[1].verified).toBe(false);
    expect(fromAbsent.toSave[1].strength).toBe('declared');
    expect(fromAbsent.toSave[1].verified).toBe(false);
  });

  it('ignore les preuves non test et les preuves déjà remplacées', () => {
    const doc = anEvidence({ type: 'documentation', reference: 'https://confluence/page' });
    const replaced = anEvidence({ replacedBy: 'ev-newer' });

    const update = applyCiSummaryToEvidences([doc, replaced], aCiSummary(), ids, now);

    expect(update.toSave).toHaveLength(0);
    expect(update.updatedCount).toBe(0);
    expect(update.reconfirmCount).toBe(0);
  });
});
