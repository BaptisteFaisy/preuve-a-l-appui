/**
 * Quand le scénario remplace l'histoire d'un ticket, l'ancienne prend fin —
 * proprement : ses critères passent « superseded », ses dérogations sont
 * révoquées, ses paires test ↔ critère rejetées. Rien n'est supprimé, mais
 * seule la nouvelle histoire compte dans la couverture (SPEC §8.3, §12.4).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BOOTSTRAP_TOKEN_VAR, handleBootstrap } from '../../src/handlers/bootstrap.js';
import { createAcceptanceHarness, PROJECT_ID } from '../acceptance/harness.js';
import type { AcceptanceHarness } from '../acceptance/harness.js';
import { anIssue } from '../helpers/builders.js';

const TOKEN = 'jeton-d-amorcage-de-test';
const ISSUE = { id: '20003', key: 'PAY-902' };
const CAST = {
  developer: 'user-dev',
  tester: 'user-tester',
  owner: 'user-po',
  agent: 'agent-coder',
};

afterEach(() => {
  delete process.env[BOOTSTRAP_TOKEN_VAR];
});

/** La première histoire : deux critères, une preuve, une dérogation, une paire. */
const FIRST = {
  criteria: [
    {
      code: 'AC-1',
      text: "L'e-mail de refus part vers l'adresse du client",
      type: 'functional',
      requiredStrength: 'machine-verified',
    },
    {
      code: 'AC-2',
      text: 'Un même refus n’envoie qu’un seul e-mail',
      type: 'regression',
      requiredStrength: 'attested',
    },
  ],
  evidences: [
    {
      criterion: 'AC-1',
      type: 'test',
      reference: 'refusal email reaches the customer',
    },
  ],
  attest: [],
  waive: [
    {
      code: 'AC-2',
      accountId: 'user-po',
      role: 'Product Owner',
      reason: 'Reporté à la version 2.5',
    },
  ],
  links: [
    { code: 'AC-1', testName: 'refusal email reaches the customer', status: 'confirmed' },
  ],
  revisions: [],
};

/** La seconde histoire : d'autres critères, d'autres preuves, d'autres gestes. */
const SECOND = {
  criteria: [
    {
      code: 'AC-1',
      text: 'Le client reçoit un e-mail de refus en moins de deux minutes',
      type: 'performance',
      requiredStrength: 'machine-verified',
    },
  ],
  evidences: [
    { criterion: 'AC-1', type: 'documentation', reference: 'docs/refus.md' },
  ],
  attest: [{ code: 'AC-1', accountId: 'user-tester', note: 'Délai mesuré' }],
  waive: [],
  links: [{ code: 'AC-1', testName: 'refusal email within two minutes' }],
  revisions: [],
};

/** Amorce le ticket avec le scénario donné. */
async function bootstrap(h: AcceptanceHarness, scenario: unknown): Promise<void> {
  process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
  const outcome = await handleBootstrap(
    {
      method: 'POST',
      headers: { 'x-bootstrap-token': TOKEN },
      body: JSON.stringify({
        action: 'bootstrap',
        issueKey: ISSUE.key,
        ciKey: 'cle-ci-reelle',
        cast: CAST,
        scenario,
      }),
    },
    h.deps,
  );
  expect(outcome.statusCode).toBe(200);
}

/** Le harnais avec le ticket de l'histoire. */
async function harness(): Promise<AcceptanceHarness> {
  const h = await createAcceptanceHarness();
  h.scenario.jira.addIssue(
    anIssue({ id: ISSUE.id, key: ISSUE.key, projectId: PROJECT_ID }),
  );
  return h;
}

describe('amorçage — le remplacement d’une histoire', () => {
  it('supersede les critères d’avant et revoke ses dérogations', async () => {
    const h = await harness();
    await bootstrap(h, FIRST);

    const before = await h.deps.store.listCriteriaByIssue(ISSUE.id);
    expect(before.filter((criterion) => criterion.status === 'active')).toHaveLength(2);
    const waiversBefore = await h.deps.store.listWaiversByIssue(ISSUE.id);
    expect(waiversBefore).toHaveLength(1);
    expect(waiversBefore[0]?.revokedAt).toBe('');

    await bootstrap(h, SECOND);

    const after = await h.deps.store.listCriteriaByIssue(ISSUE.id);
    const active = after.filter((criterion) => criterion.status === 'active');
    const superseded = after.filter((criterion) => criterion.status === 'superseded');
    // L'ancienne histoire est là, mais inactive ; la nouvelle est active.
    expect(active).toHaveLength(1);
    expect(active[0]?.text).toBe('Le client reçoit un e-mail de refus en moins de deux minutes');
    expect(superseded).toHaveLength(2);

    // La dérogation d'avant est révoquée : elle ne compte plus.
    const waiversAfter = await h.deps.store.listWaiversByIssue(ISSUE.id);
    expect(waiversAfter).toHaveLength(1);
    expect(waiversAfter[0]?.revokedAt).not.toBe('');
  });

  it('rejette les paires test ↔ critère de l’ancienne histoire', async () => {
    const h = await harness();
    await bootstrap(h, FIRST);
    await bootstrap(h, SECOND);

    const links = await h.deps.store.listConfirmedLinksByTest(
      'refusal email reaches the customer',
    );
    expect(links).toHaveLength(0);
    const fresh = await h.deps.store.listConfirmedLinksByTest(
      'refusal email within two minutes',
    );
    expect(fresh).toHaveLength(1);
  });

  it('ne touche à rien quand le scénario est le même', async () => {
    const h = await harness();
    await bootstrap(h, FIRST);
    await bootstrap(h, FIRST);

    const criteria = await h.deps.store.listCriteriaByIssue(ISSUE.id);
    expect(criteria.filter((criterion) => criterion.status === 'active')).toHaveLength(2);
    expect(criteria.filter((criterion) => criterion.status === 'superseded')).toHaveLength(0);
    const waivers = await h.deps.store.listWaiversByIssue(ISSUE.id);
    expect(waivers[0]?.revokedAt).toBe('');
  });
});
