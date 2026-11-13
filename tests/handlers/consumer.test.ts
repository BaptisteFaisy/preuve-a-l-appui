/**
 * Tests du consommateur de CI (SPEC §17, points 2 à 4 ; §10 ; §13).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { onCiMessage } from '../../src/handlers/consumer.js';
import type { CiIngestMessage } from '../../src/ports.js';
import {
  BRANCH,
  COMMIT,
  ISSUE_ID,
  ISSUE_KEY,
  PROJECT_ID,
  TEST_REFUSAL,
  aCiSummary,
  aCoverage,
  aTestLink,
  aTestOutcome,
} from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';
import { NOW_ISO, depsFromScenario } from '../ingest/ci-deps.js';

describe('consumer — onCiMessage', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario(NOW_ISO);
  });

  it('enregistre le run et ses résultats', async () => {
    const summary = aCiSummary({ commit: COMMIT });
    const message: CiIngestMessage = { runId: 'run-test-1', projectId: PROJECT_ID, summary };
    const deps = depsFromScenario(scenario);

    await onCiMessage(message, deps);

    const savedRun = await scenario.store.getTestRun('run-test-1');
    expect(savedRun).not.toBeNull();
    expect(savedRun?.commit).toBe(COMMIT);

    const savedResults = await scenario.store.listTestResults('run-test-1');
    expect(savedResults.length).toBeGreaterThan(0);
  });

  it('met à jour les preuves de test et recalcule la couverture du ticket trouvé', async () => {
    const summary = aCiSummary({
      branch: BRANCH, // contient PAY-123
      commit: 'new-commit-42',
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'passed' })],
    });
    const message: CiIngestMessage = { runId: 'run-test-2', projectId: PROJECT_ID, summary };
    const deps = depsFromScenario(scenario);
    // Le moteur de couverture est celui du lot L3 : ici, le double scripté.
    scenario.coverage.script(aCoverage({ issueId: ISSUE_ID, proven: 2, total: 4 }));

    await onCiMessage(message, deps);

    // Couverture recalculée par deps.coverage.recompute (SPEC §12.3)
    expect(scenario.coverage.journal.count('recompute')).toBeGreaterThan(0);
    expect(scenario.coverage.journal.argsOf('recompute')[0]).toEqual([ISSUE_ID]);

    // Champ « Preuves n / m » écrit sur le ticket (SPEC §12.3, §17)
    expect(scenario.jira.coverageFields).toHaveLength(1);
    expect(scenario.jira.coverageFields[0].issueId).toBe(ISSUE_ID);
    expect(scenario.jira.coverageFields[0].label).toBe('2 / 4');
  });

  it('n’écrit pas le champ de couverture quand le moteur ne rend aucune ligne', async () => {
    const summary = aCiSummary({ branch: BRANCH, commit: 'new-commit-43' });
    const message: CiIngestMessage = { runId: 'run-no-coverage', projectId: PROJECT_ID, summary };
    const deps = depsFromScenario(scenario);

    await onCiMessage(message, deps);

    expect(scenario.coverage.journal.count('recompute')).toBe(1);
    expect(scenario.jira.coverageFields).toHaveLength(0);
    expect(scenario.logger.atLevel('warn')).toContain('ci.coverage.missing');
  });

  it('écrit le libellé du champ dans la langue du projet (SPEC §20)', async () => {
    await scenario.store.saveSettings({ ...scenario.project, language: 'fr' });
    scenario.coverage.script(aCoverage({ issueId: ISSUE_ID, proven: 3, total: 4 }));
    const message: CiIngestMessage = {
      runId: 'run-fr',
      projectId: PROJECT_ID,
      summary: aCiSummary({ branch: BRANCH }),
    };

    await onCiMessage(message, depsFromScenario(scenario));

    expect(scenario.jira.coverageFields[0].label).toBe('3 / 4');
  });

  it('ignore calmement une branche sans clé de ticket', async () => {
    const summary = aCiSummary({ branch: 'chore/cleanup-scripts' });
    const message: CiIngestMessage = { runId: 'run-chore', projectId: PROJECT_ID, summary };
    const deps = depsFromScenario(scenario);

    await onCiMessage(message, deps);

    expect(scenario.coverage.journal.count('recompute')).toBe(0);
    expect(scenario.jira.coverageFields).toHaveLength(0);
  });

  it('sur la branche principale, met à jour la preuve vivante des tickets clos (SPEC §13)', async () => {
    // Ticket PAY-123 passé à "Done"
    const doneIssue = { ...scenario.issue, status: 'Done' };
    scenario.jira.issues.length = 0;
    scenario.jira.addIssue(doneIssue);

    // Paire confirmée AC-1 ↔ TEST_REFUSAL
    await scenario.store.saveLink(
      aTestLink({ criterionId: 'crit-1', testName: TEST_REFUSAL, status: 'confirmed' }),
    );

    // Run sur la branche principale où le test passe
    const summary = aCiSummary({
      branch: 'main',
      mainBranch: true,
      commit: 'commit-on-main',
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'passed' })],
    });
    const message: CiIngestMessage = { runId: 'run-main-1', projectId: PROJECT_ID, summary };
    const deps = depsFromScenario(scenario);

    await onCiMessage(message, deps);

    const living = await scenario.store.listLivingByProject(PROJECT_ID);
    expect(living).toHaveLength(1);
    expect(living[0].state).toBe('proven');
    expect(living[0].testName).toBe(TEST_REFUSAL);
  });

  it('signale le ticket quand un test suivi sur main échoue ou disparaît (SPEC §7.5, §13)', async () => {
    const doneIssue = { ...scenario.issue, status: 'Done', assigneeAccountId: 'dev-1' };
    scenario.jira.issues.length = 0;
    scenario.jira.addIssue(doneIssue);

    await scenario.store.saveLink(
      aTestLink({ criterionId: 'crit-1', testName: TEST_REFUSAL, status: 'confirmed' }),
    );

    // Run sur main : TEST_REFUSAL a échoué
    const summary = aCiSummary({
      branch: 'main',
      mainBranch: true,
      commit: 'commit-regressed',
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })],
    });
    const message: CiIngestMessage = { runId: 'run-main-fail', projectId: PROJECT_ID, summary };
    const deps = depsFromScenario(scenario);

    await onCiMessage(message, deps);

    const living = await scenario.store.listLivingByProject(PROJECT_ID);
    expect(living[0].state).toBe('regressed');

    // Notification émise sur le ticket (SPEC §7.5)
    expect(scenario.jira.notifications.length).toBeGreaterThan(0);
    expect(scenario.jira.notifications[0].issueKey).toBe(ISSUE_KEY);
  });

  it('ignore un message mal formé sans lever d’exception', async () => {
    const deps = depsFromScenario(scenario);
    await expect(onCiMessage({} as unknown as CiIngestMessage, deps)).resolves.toBeUndefined();
    await expect(onCiMessage(null as unknown as CiIngestMessage, deps)).resolves.toBeUndefined();
  });
});
