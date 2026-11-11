/**
 * Tests du calcul de la couverture et du moteur de couverture (SPEC §7, §12, §22).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  aCriterion,
  anEvidence,
  anIssue,
  aWaiver,
  ISSUE_ID,
  ISSUE_KEY,
  PROJECT_ID,
  settings as buildSettings,
} from '../helpers/builders.js';
import { createFakeClock, createRecordingLogger } from '../helpers/fake-clock.js';
import { createFakeJira } from '../helpers/fake-gateways.js';
import { createFakeStore } from '../helpers/fake-store.js';
import { buildCoverage, coverageFieldLabel } from '../../src/domain/coverage.js';
import { createCoverageEngine } from '../../src/domain/coverage-engine.js';

describe('domain/coverage — calcul de couverture par critère', () => {
  const now = '2026-11-11T12:00:00.000Z';
  const settings = buildSettings();

  it('un critère sans preuve a le défaut no-evidence', () => {
    const criterion = aCriterion({ id: 'c1', code: 'AC-1' });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [criterion],
      evidences: [],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.total).toBe(1);
    expect(coverage.proven).toBe(0);
    expect(coverage.passes).toBe(false);
    expect(coverage.blocking[0]?.defect).toBe('no-evidence');
  });

  it('un critère avec preuve vérifiée et fraîche atteint l’exigence (SPEC §22 pt 2)', () => {
    const criterion = aCriterion({
      id: 'c1',
      code: 'AC-1',
      type: 'functional',
      requiredStrength: 'machine-verified',
    });
    const evidence = anEvidence({
      criterionId: 'c1',
      strength: 'machine-verified',
      verified: true,
      freshness: 'fresh',
    });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [criterion],
      evidences: [evidence],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.total).toBe(1);
    expect(coverage.proven).toBe(1);
    expect(coverage.passes).toBe(true);
    expect(coverage.blocking).toHaveLength(0);
    expect(coverage.criteria[0]?.proven).toBe(true);
  });

  it('une preuve non fraîche donne le défaut not-fresh (SPEC §22 pt 8)', () => {
    const criterion = aCriterion({ id: 'c1', requiredStrength: 'machine-verified' });
    const evidence = anEvidence({
      criterionId: 'c1',
      strength: 'machine-verified',
      verified: true,
      freshness: 'to-reconfirm',
    });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [criterion],
      evidences: [evidence],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.proven).toBe(0);
    expect(coverage.blocking[0]?.defect).toBe('not-fresh');
  });

  it('une preuve de force déclarée ne satisfait pas une exigence attestée (SPEC §22 pt 5)', () => {
    const criterion = aCriterion({ id: 'c1', requiredStrength: 'attested' });
    const evidence = anEvidence({
      criterionId: 'c1',
      strength: 'declared',
      verified: true,
      freshness: 'fresh',
      addedByAgent: true,
    });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [criterion],
      evidences: [evidence],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.proven).toBe(0);
    expect(coverage.blocking[0]?.defect).toBe('weak-strength');
  });

  it('une dérogation motivée valide le passage (SPEC §22 pt 6)', () => {
    const criterion = aCriterion({ id: 'c1', code: 'AC-4', requiredStrength: 'attested' });
    const waiver = aWaiver({ criterionId: 'c1', reason: 'Reporté dans PAY-140' });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [criterion],
      evidences: [],
      waivers: [waiver],
      settings,
      now,
    });
    expect(coverage.waived).toBe(1);
    expect(coverage.proven).toBe(0);
    expect(coverage.passes).toBe(true);
    expect(coverage.blocking).toHaveLength(0);
  });
});

describe('domain/coverage — cas limites et modes (SPEC §8.3, §12.2, §21)', () => {
  const now = '2026-11-11T12:00:00.000Z';

  it('un ticket sans critère bloque si la politique est block (SPEC §8.3)', () => {
    const settings = buildSettings({ missingCriteria: 'block' });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [],
      evidences: [],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.passes).toBe(false);
    expect(coverage.blocking[0]?.defect).toBe('no-criteria');
  });

  it('un ticket sans critère passe si la politique est suggest (SPEC §8.3)', () => {
    const settings = buildSettings({ missingCriteria: 'suggest' });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [],
      evidences: [],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.passes).toBe(true);
    expect(coverage.blocking).toHaveLength(0);
  });

  it('en mode observe, la transition passe et wouldBlock est vrai (SPEC §22 pt 9)', () => {
    const settings = buildSettings({ mode: 'observe' });
    const criterion = aCriterion({ id: 'c1' });
    const coverage = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [criterion],
      evidences: [],
      waivers: [],
      settings,
      now,
    });
    expect(coverage.passes).toBe(true);
    expect(coverage.wouldBlock).toBe(true);
  });

  it('en mode lenient, seuls les critères mineurs passent (SPEC §12.2)', () => {
    const settings = buildSettings({ mode: 'lenient' });
    const docCrit = aCriterion({ id: 'c-doc', type: 'documentation', requiredStrength: 'machine-verified' });
    const coverageDocOnly = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [docCrit],
      evidences: [],
      waivers: [],
      settings,
      now,
    });
    // documentation est minor dans DEFAULT_REQUIREMENTS
    expect(coverageDocOnly.passes).toBe(true);
    expect(coverageDocOnly.wouldBlock).toBe(true);

    const funcCrit = aCriterion({ id: 'c-func', type: 'functional' });
    const coverageWithMajor = buildCoverage({
      issueId: ISSUE_ID,
      issueKey: ISSUE_KEY,
      criteria: [docCrit, funcCrit],
      evidences: [],
      waivers: [],
      settings,
      now,
    });
    expect(coverageWithMajor.passes).toBe(false);
  });

  it('formate le libellé du champ de couverture en français et en anglais', () => {
    expect(coverageFieldLabel(3, 4, 'fr')).toBe('Preuves 3 / 4');
    expect(coverageFieldLabel(3, 4, 'en')).toBe('Proofs 3 / 4');
  });
});

describe('domain/coverage-engine — moteur unifié (CONTRACTS.md §1bis, SPEC §22 pt 10)', () => {
  it('recalcule, stocke et met à jour le champ de couverture', async () => {
    const store = createFakeStore();
    const clock = createFakeClock('2026-11-11T12:00:00.000Z');
    const logger = createRecordingLogger();
    const jira = createFakeJira([anIssue()]);

    const crit = aCriterion({ id: 'c1', issueId: ISSUE_ID, code: 'AC-1' });
    await store.saveCriterion(crit);
    await store.saveSettings(buildSettings({ projectId: PROJECT_ID }));

    const engine = createCoverageEngine({ store, clock, logger, jira });
    const computed = await engine.recompute(ISSUE_ID);

    expect(computed).not.toBeNull();
    expect(computed?.issueKey).toBe(ISSUE_KEY);
    expect(computed?.total).toBe(1);
    expect(computed?.proven).toBe(0);

    // Une lecture ultérieure lit la même ligne stockée (SPEC §22 pt 10)
    const readRow = await engine.read(ISSUE_ID);
    expect(readRow).toEqual(computed);

    // Le champ de couverture a été mis à jour (FP-16)
    expect(jira.coverageFields).toHaveLength(1);
    expect(jira.coverageFields[0]?.label).toBe('Proofs 0 / 1');
  });

  it('sans Jira, retombe sur l’identifiant et les réglages par défaut', async () => {
    const store = createFakeStore();
    const clock = createFakeClock();
    const logger = createRecordingLogger();
    await store.saveCriterion(aCriterion({ id: 'c1', issueId: ISSUE_ID }));

    const engine = createCoverageEngine({ store, clock, logger });
    const computed = await engine.recompute(ISSUE_ID);
    expect(computed?.issueKey).toBe(ISSUE_ID);
    expect(computed?.mode).toBe('strict');
  });

  it('exige la couverture des sous-tâches quand le projet le demande (SPEC §21)', async () => {
    const store = createFakeStore();
    const clock = createFakeClock();
    const logger = createRecordingLogger();
    const jira = createFakeJira([anIssue({ children: ['child-1'] })]);
    await store.saveSettings(buildSettings({ projectId: PROJECT_ID, requireChildren: true }));
    await store.saveCriterion(aCriterion({ id: 'c1', issueId: ISSUE_ID }));
    await store.saveEvidence(
      anEvidence({ id: 'e1', criterionId: 'c1', strength: 'machine-verified' }),
    );

    const engine = createCoverageEngine({ store, clock, logger, jira });
    const blocked = await engine.recompute(ISSUE_ID);
    expect(blocked?.passes).toBe(false);
    expect(blocked?.blocking.some((item) => item.code === 'SUBTASKS')).toBe(true);
  });
});
