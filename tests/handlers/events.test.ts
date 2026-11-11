/**
 * Tests du déclencheur `avi:jira:updated:issue` (SPEC §17, §8.2, §12.3).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { extractIssueTarget, hasDescriptionChanged, onJiraEvent } from '../../src/handlers/events.js';
import { ISSUE_ID, ISSUE_KEY } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';
import { NOW_ISO, depsFromScenario } from '../ingest/ci-deps.js';

/** Événement Forge : la description du ticket a été modifiée. */
function descriptionChanged(field = 'description'): Record<string, unknown> {
  return {
    issue: { id: ISSUE_ID, key: ISSUE_KEY },
    changelog: { items: [{ field, fromString: 'avant', toString: 'après' }] },
  };
}

describe('events — lecture de l’événement', () => {
  it('extrait le ticket de la charge utile, par id ou par clé', () => {
    expect(extractIssueTarget({ issue: { id: ISSUE_ID, key: ISSUE_KEY } })).toEqual({
      id: ISSUE_ID,
      key: ISSUE_KEY,
    });
    expect(extractIssueTarget({ issue: { key: ISSUE_KEY } })).toEqual({
      id: ISSUE_KEY,
      key: ISSUE_KEY,
    });
    expect(extractIssueTarget({})).toBeNull();
    expect(extractIssueTarget('pas-un-objet')).toBeNull();
  });

  it('ne retient que les modifications de la description (SPEC §8.2)', () => {
    expect(hasDescriptionChanged(descriptionChanged())).toBe(true);
    expect(hasDescriptionChanged(descriptionChanged('assignee'))).toBe(false);
    // Changelog absent ou vide : dans le doute, on traite l'événement.
    expect(hasDescriptionChanged({ issue: { id: ISSUE_ID } })).toBe(true);
    expect(hasDescriptionChanged({ changelog: { items: [] } })).toBe(true);
  });
});

describe('events — onJiraEvent', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario(NOW_ISO);
  });

  it('recalcule la couverture quand la description change', async () => {
    const deps = depsFromScenario(scenario);

    await onJiraEvent(descriptionChanged(), deps);

    expect(scenario.jira.journal.argsOf('getIssue')).toEqual([[ISSUE_ID]]);
    expect(scenario.coverage.journal.count('recompute')).toBe(1);
    expect(scenario.coverage.journal.argsOf('recompute')[0]).toEqual([ISSUE_ID]);
  });

  it('ne recalcule pas pour un changement qui ne touche pas les critères', async () => {
    const deps = depsFromScenario(scenario);

    await onJiraEvent(descriptionChanged('assignee'), deps);

    expect(scenario.coverage.journal.count('recompute')).toBe(0);
    expect(scenario.jira.journal.count('getIssue')).toBe(0);
    expect(scenario.logger.atLevel('info')).toContain('ci.events.not_criteria');
  });

  it('ignore calmement un événement sans ticket', async () => {
    const deps = depsFromScenario(scenario);

    await expect(onJiraEvent({}, deps)).resolves.toBeUndefined();

    expect(scenario.coverage.journal.count('recompute')).toBe(0);
    expect(scenario.logger.atLevel('info')).toContain('ci.events.no_issue');
  });

  it('journalise un ticket introuvable sans recalculer', async () => {
    const deps = depsFromScenario(scenario);
    const payload = {
      issue: { id: 'inconnu', key: 'PAY-999' },
      changelog: { items: [{ field: 'description' }] },
    };

    await onJiraEvent(payload, deps);

    expect(scenario.coverage.journal.count('recompute')).toBe(0);
    expect(scenario.logger.atLevel('warn')).toContain('ci.events.issue_not_found');
  });
});
