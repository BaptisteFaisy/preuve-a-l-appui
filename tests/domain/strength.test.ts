/**
 * Tests de la force des preuves (SPEC §9.1, §22 points 2-3, FP-03, FP-04).
 *
 * Chaque type de preuve et sa force, la capture attestée, la vérification via
 * le port `EvidenceChecker` (jamais de réseau dans le domaine) et la règle
 * « test vert sur le commit de la branche ».
 */
import { describe, expect, it } from 'vitest';
import {
  computeEvidenceStrength,
  defaultStrengthForEvidenceType,
  strengthWithAttestation,
  verifyTestAgainstRun,
} from '../../src/domain/strength.js';
import type { TestOutcome } from '../../src/types.js';
import { aTestOutcome, COMMIT, ISSUE_ID, TEST_REFUSAL } from '../helpers/builders.js';
import { createFakeEvidenceChecker } from '../helpers/fake-gateways.js';

const RUN = { outcomes: [aTestOutcome({ name: TEST_REFUSAL })] as readonly TestOutcome[], commit: COMMIT };

describe('force intrinsèque par type (SPEC §9.1)', () => {
  it('test et documentation sont vérifiés par machine', () => {
    expect(defaultStrengthForEvidenceType('test')).toBe('machine-verified');
    expect(defaultStrengthForEvidenceType('documentation')).toBe('machine-verified');
  });

  it('attestation est attestée', () => {
    expect(defaultStrengthForEvidenceType('attestation')).toBe('attested');
  });

  it('capture, compte rendu d’agent et lien libre sont déclarés', () => {
    expect(defaultStrengthForEvidenceType('attachment')).toBe('declared');
    expect(defaultStrengthForEvidenceType('agent-report')).toBe('declared');
    expect(defaultStrengthForEvidenceType('link')).toBe('declared');
  });

  it('une capture seule reste déclarée : l’app ne lit pas les images', () => {
    expect(strengthWithAttestation('attachment', false)).toBe('declared');
  });

  it('une capture accompagnée d’une attestation prend la force de l’attestation', () => {
    expect(strengthWithAttestation('attachment', true)).toBe('attested');
  });

  it('l’attestation liée ne change pas la force des autres types', () => {
    expect(strengthWithAttestation('link', true)).toBe('declared');
    expect(strengthWithAttestation('agent-report', true)).toBe('declared');
  });
});

describe('test automatisé contre les résultats de CI (SPEC §9.1, §22)', () => {
  it('donne machine-verified quand le test passe sur le commit de la branche', () => {
    const result = verifyTestAgainstRun({
      type: 'test',
      reference: TEST_REFUSAL,
      commit: COMMIT,
      run: RUN,
    });
    expect(result).toEqual({ verified: true, strength: 'machine-verified' });
  });

  it('ne donne aucune preuve valable quand le test est absent des résultats', () => {
    const result = verifyTestAgainstRun({
      type: 'test',
      reference: 'un test qui n’existe pas',
      commit: COMMIT,
      run: RUN,
    });
    expect(result).toEqual({ verified: false, strength: 'declared' });
  });

  it('ne donne aucune preuve valable quand le test échoue', () => {
    const failed = { outcomes: [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })], commit: COMMIT };
    const result = verifyTestAgainstRun({ type: 'test', reference: TEST_REFUSAL, commit: COMMIT, run: failed });
    expect(result?.verified).toBe(false);
  });

  it('ne donne aucune preuve valable quand le test est ignoré', () => {
    const skipped = { outcomes: [aTestOutcome({ name: TEST_REFUSAL, state: 'skipped' })], commit: COMMIT };
    const result = verifyTestAgainstRun({ type: 'test', reference: TEST_REFUSAL, commit: COMMIT, run: skipped });
    expect(result?.verified).toBe(false);
  });

  it('exige le même commit que celui du run de la branche', () => {
    const result = verifyTestAgainstRun({
      type: 'test',
      reference: TEST_REFUSAL,
      commit: 'autre-commit',
      run: RUN,
    });
    expect(result).toEqual({ verified: false, strength: 'declared' });
  });

  it('sans résultats de CI reçus, la preuve de test n’est pas vérifiée', () => {
    const result = verifyTestAgainstRun({ type: 'test', reference: TEST_REFUSAL, commit: COMMIT });
    expect(result).toEqual({ verified: false, strength: 'declared' });
  });

  it('ignore la règle test pour les autres types', () => {
    expect(verifyTestAgainstRun({ type: 'link', reference: 'https://x', run: RUN })).toBeNull();
  });
});

describe('vérification par le port EvidenceChecker (mission L2, exigence 2)', () => {
  it('page de documentation : machine-verified si la page a changé après l’ouverture', async () => {
    const checker = createFakeEvidenceChecker({
      documentation: { 'https://wiki.example/refus': '2026-11-11T10:00:00.000Z' },
    });
    const result = await computeEvidenceStrength(
      {
        type: 'documentation',
        reference: 'https://wiki.example/refus',
        since: '2026-11-11T08:00:00.000Z',
      },
      checker,
    );
    expect(result).toEqual({ verified: true, strength: 'machine-verified' });
  });

  it('page de documentation : non vérifiée si la page n’a pas changé depuis', async () => {
    const checker = createFakeEvidenceChecker({
      documentation: { 'https://wiki.example/refus': '2026-11-11T07:00:00.000Z' },
    });
    const result = await computeEvidenceStrength(
      {
        type: 'documentation',
        reference: 'https://wiki.example/refus',
        since: '2026-11-11T08:00:00.000Z',
      },
      checker,
    );
    expect(result.verified).toBe(false);
    expect(checker.journal.count('documentationPage')).toBe(1);
  });

  it('capture : vérifiée si la pièce du ticket existe', async () => {
    const checker = createFakeEvidenceChecker({ attachments: [`${ISSUE_ID}::screenshot.png`] });
    const result = await computeEvidenceStrength(
      { type: 'attachment', reference: 'screenshot.png', issueId: ISSUE_ID },
      checker,
    );
    expect(result).toEqual({ verified: true, strength: 'declared' });
  });

  it('capture attestée par un tiers : vérifiée et force attestée', async () => {
    const checker = createFakeEvidenceChecker({ attachments: [`${ISSUE_ID}::screenshot.png`] });
    const result = await computeEvidenceStrength(
      {
        type: 'attachment',
        reference: 'screenshot.png',
        issueId: ISSUE_ID,
        hasValidAttestation: true,
      },
      checker,
    );
    expect(result).toEqual({ verified: true, strength: 'attested' });
  });

  it('compte rendu d’agent : vérifié si la section existe et cite le critère', async () => {
    const checker = createFakeEvidenceChecker({ reports: [`${ISSUE_ID}::report#ac-3::AC-3`] });
    const result = await computeEvidenceStrength(
      { type: 'agent-report', reference: 'report#ac-3', issueId: ISSUE_ID, criterionCode: 'AC-3' },
      checker,
    );
    expect(result).toEqual({ verified: true, strength: 'declared' });
  });

  it('compte rendu d’agent : non vérifié si la section ne cite pas le critère', async () => {
    const checker = createFakeEvidenceChecker({ reports: [`${ISSUE_ID}::report#ac-3::AC-3`] });
    const result = await computeEvidenceStrength(
      { type: 'agent-report', reference: 'report#ac-3', issueId: ISSUE_ID, criterionCode: 'AC-4' },
      checker,
    );
    expect(result.verified).toBe(false);
  });

  it('lien libre : vérifié s’il est joignable', async () => {
    const checker = createFakeEvidenceChecker({ links: ['https://ci.example/run/42'] });
    const result = await computeEvidenceStrength(
      { type: 'link', reference: 'https://ci.example/run/42' },
      checker,
    );
    expect(result).toEqual({ verified: true, strength: 'declared' });
  });

  it('attestation : la force est attestée sans appel réseau', async () => {
    const checker = createFakeEvidenceChecker();
    const result = await computeEvidenceStrength(
      { type: 'attestation', reference: 'clic-j-ai-verifie' },
      checker,
    );
    expect(result).toEqual({ verified: true, strength: 'attested' });
    expect(checker.journal.calls).toHaveLength(0);
  });

  it('sans vérificateur, la vérification de contenu passe (l’app ne peut pas vérifier)', async () => {
    const result = await computeEvidenceStrength({ type: 'link', reference: 'https://x' });
    expect(result.strength).toBe('declared');
    expect(result.verified).toBe(true);
  });

  it('ne fait jamais d’appel réseau : seul le journal du fake bouge', async () => {
    const checker = createFakeEvidenceChecker({ links: [] });
    await computeEvidenceStrength({ type: 'link', reference: 'https://inconnu' }, checker);
    expect(checker.journal.methods()).toEqual(['linkReachable']);
  });
});
