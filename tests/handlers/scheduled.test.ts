/**
 * Tests du contrôle nocturne des clôtures hors validateur (SPEC §20, §22).
 *
 * Étanchéité annoncée : l'app liste chaque nuit les tickets passés à
 * « Terminé » sans couverture suffisante et les signale.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  aCoverage,
  anIssue,
  OWNER,
  PROJECT_ID,
  settings as buildSettings,
} from '../helpers/builders.js';
import { createFakeJira } from '../helpers/fake-gateways.js';
import { createFakeStore } from '../helpers/fake-store.js';
import { onScheduledTick } from '../../src/handlers/scheduled.js';
import { buildL3Deps } from './app-deps.js';

const CLOSED_KEY = 'PAY-999';

/** Store + Jira avec un ticket clos sans couverture et son déclarant. */
async function nightlySetup(options: { language?: 'en' | 'fr'; limit?: number } = {}) {
  const store = createFakeStore();
  const jira = createFakeJira([
    anIssue({ id: CLOSED_KEY, key: CLOSED_KEY, reporterAccountId: OWNER }),
  ]);
  await store.saveSettings(
    buildSettings({ projectId: PROJECT_ID, language: options.language ?? 'en' }),
  );
  store.recordClosed(CLOSED_KEY, PROJECT_ID);
  const { deps, logger } = buildL3Deps(store, jira);
  return { deps, store, jira, logger };
}

describe('handlers/scheduled — contrôle nocturne (SPEC §20)', () => {
  it('liste et signale les tickets clos sans couverture suffisante', async () => {
    const { deps, logger, jira } = await nightlySetup();

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(logger.atLevel('warn')[0]).toContain(
      '1 issue(s) closed without sufficient proof in project 10000',
    );
    expect(jira.notifications).toHaveLength(1);
    expect(jira.notifications[0]).toEqual({
      accountId: OWNER,
      subjectKey: 'scheduled.leak.subject',
      bodyKey: 'scheduled.leak.body',
      issueKey: CLOSED_KEY,
      language: 'en',
    });
  });

  it('signale en français quand le projet est en français (SPEC §20)', async () => {
    const { deps, logger } = await nightlySetup({ language: 'fr' });

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(logger.atLevel('warn')[0]).toContain(
      '1 ticket(s) clos sans preuve suffisante sur le projet 10000',
    );
  });

  it('un ticket clos avec une couverture qui passe n’est pas signalé', async () => {
    const { deps, store, logger, jira } = await nightlySetup();
    await store.saveCoverage(aCoverage({ issueId: CLOSED_KEY, passes: true }));

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(logger.atLevel('warn')).toHaveLength(0);
    expect(jira.notifications).toHaveLength(0);
  });

  it('audit propre : rien dans le journal d’alerte', async () => {
    const store = createFakeStore();
    const jira = createFakeJira();
    const { deps, logger } = buildL3Deps(store, jira);

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(logger.atLevel('warn')).toHaveLength(0);
    expect(jira.notifications).toHaveLength(0);
  });

  it('respecte la limite demandée dans la charge utile', async () => {
    const { deps, store, logger } = await nightlySetup();
    store.recordClosed('PAY-998', PROJECT_ID);
    store.recordClosed('PAY-997', PROJECT_ID);

    await onScheduledTick({ projectId: PROJECT_ID, limit: 2 }, deps);

    expect(logger.atLevel('warn')[0]).toContain('2 issue(s) closed');
  });

  it('sans projet dans la charge utile : message dédié, aucun audit', async () => {
    const { deps, logger, jira } = await nightlySetup();

    await onScheduledTick({}, deps);

    expect(logger.atLevel('info')[0]).toContain('no project id');
    expect(logger.atLevel('warn')).toHaveLength(0);
    expect(jira.notifications).toHaveLength(0);
  });
});
