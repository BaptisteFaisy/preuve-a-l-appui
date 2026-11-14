/**
 * Une dérogation qui expire **pour de vrai** (SPEC §12.4).
 *
 * Le domaine savait qu'une dérogation a une échéance ; rien ne se passait
 * quand l'échéance passait : la couverture n'était pas recalculée, et le
 * ticket restait « bon » alors que sa dérogation n'était plus valable. Le
 * contrôle nocturne s'en charge désormais — et ne signale que ce qui change.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { onScheduledTick } from '../../src/handlers/scheduled.js';
import { createFakeCoverageEngine, createFakeJira } from '../helpers/fake-gateways.js';
import { createFakeStore } from '../helpers/fake-store.js';
import {
  anIssue,
  OWNER,
  PROJECT_ID,
  settings as buildSettings,
} from '../helpers/builders.js';
import { buildL3Deps } from './app-deps.js';

const ISSUE_ID = '66701';
const ISSUE_KEY = 'PAY-7';
const CRITERION_ID = '66701-crit-AC-1';

/** Un ticket de démonstration, ses réglages et son critère de performance. */
async function setupTicket() {
  const store = createFakeStore();
  const jira = createFakeJira([
    anIssue({
      id: ISSUE_ID,
      key: ISSUE_KEY,
      projectId: PROJECT_ID,
      projectKey: 'PAY',
      reporterAccountId: OWNER,
    }),
  ]);
  await store.saveSettings(buildSettings({ projectId: PROJECT_ID, language: 'fr' }));
  store.linkIssue(ISSUE_ID, PROJECT_ID).linkIssue(ISSUE_KEY, PROJECT_ID);
  await store.saveCriterion({
    id: CRITERION_ID,
    issueId: ISSUE_ID,
    code: 'AC-1',
    text: 'Le refus est répondu en moins de 200 ms',
    type: 'performance',
    requiredStrength: 'attested',
    version: 1,
    status: 'active',
    createdBy: OWNER,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  });
  await store.saveCoverage({
    issueId: ISSUE_ID,
    issueKey: ISSUE_KEY,
    total: 1,
    proven: 0,
    waived: 1,
    mode: 'strict',
    passes: true,
    wouldBlock: false,
    blocking: [],
    criteria: [],
    updatedAt: '2026-11-01T10:00:00.000Z',
  });
  return { store, jira };
}

/** La dérogation du critère, avec l'échéance demandée. */
async function grantWaiver(store: ReturnType<typeof createFakeStore>, expiresAt: string) {
  await store.saveWaiver({
    id: 'wv-1',
    criterionId: CRITERION_ID,
    grantedBy: OWNER,
    role: 'Product Owner',
    reason: 'Reporté à la version 2.5',
    at: '2026-11-01T10:00:00.000Z',
    expiresAt,
    revokedAt: '',
  });
}

/** Un ticket, ses réglages et une dérogation qui expire. */
async function setup(expiresAt: string) {
  const { store, jira } = await setupTicket();
  await grantWaiver(store, expiresAt);
  // Le moteur de couverture est scripté : une fois la dérogation expirée, la
  // couverture change (le critère n'est plus dérogé, le ticket ne passe plus).
  const engine = createFakeCoverageEngine(store);
  engine.script({
    issueId: ISSUE_ID,
    issueKey: ISSUE_KEY,
    total: 1,
    proven: 0,
    waived: 0,
    mode: 'strict',
    passes: false,
    wouldBlock: true,
    blocking: [],
    criteria: [],
    updatedAt: '2026-11-11T09:00:00.000Z',
  });
  const { deps, logger } = buildL3Deps(store, jira, engine);
  return { deps, store, jira, logger };
}

describe('handlers/scheduled — la dérogation qui expire', () => {
  it('signale une dérogation dont l’échéance est passée', async () => {
    const { deps, jira } = await setup('2026-11-02T10:00:00.000Z');

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(jira.notifications).toHaveLength(1);
    expect(jira.notifications[0]?.subjectKey).toBe('scheduled.waiver.expired.subject');
    expect(jira.notifications[0]?.language).toBe('fr');
  });

  it('ne signale pas une dérogation qui n’a pas expiré', async () => {
    const { deps, jira } = await setup('2099-11-02T10:00:00.000Z');

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(jira.notifications.filter((one) => one.subjectKey === 'scheduled.waiver.expired.subject'))
      .toHaveLength(0);
  });

  it('ne signale pas une dérogation déjà révoquée', async () => {
    const { deps, store, jira } = await setup('2026-11-02T10:00:00.000Z');
    await store.revokeWaiver('wv-1', '2026-11-01T12:00:00.000Z');

    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(jira.notifications.filter((one) => one.subjectKey === 'scheduled.waiver.expired.subject'))
      .toHaveLength(0);
  });

  it('ne signale qu’une fois : le tick suivant ne trouve plus rien à changer', async () => {
    const { deps, jira } = await setup('2026-11-02T10:00:00.000Z');

    await onScheduledTick({ projectId: PROJECT_ID }, deps);
    const afterFirst = jira.notifications.length;
    await onScheduledTick({ projectId: PROJECT_ID }, deps);

    expect(jira.notifications.length).toBe(afterFirst);
  });
});
