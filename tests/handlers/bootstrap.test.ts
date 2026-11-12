/**
 * L'amorçage de l'app installée : écritures protégées par jeton, réponses
 * STATIQUES (une sortie du manifest, jamais un corps construit à l'exécution).
 *
 * Rejoué sur le harnais d'acceptation (vrais modules, doubles en mémoire).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_TOKEN_VAR,
  actionOf,
  handleBootstrap,
  parseBootstrapBody,
} from '../../src/handlers/bootstrap.js';
import { createAcceptanceHarness, ISSUE_KEY, PROJECT_ID } from '../acceptance/harness.js';
import { anIssue } from '../helpers/builders.js';

const TOKEN = 'jeton-d-amorcage-de-test';
const FRESH_ISSUE = { id: '20001', key: 'PAY-900' };

/** Le corps d'un amorçage : action, ticket, clé de CI, distribution. */
function bootstrapBody(issueKey: string = FRESH_ISSUE.key): string {
  return JSON.stringify({
    action: 'bootstrap',
    issueKey,
    ciKey: 'cle-ci-reelle',
    cast: { developer: 'user-developer', tester: 'user-tester', owner: 'user-owner' },
  });
}

/** Un runner de DDL qui note les étapes, sans toucher à Forge SQL. */
function recordingDdl(): { run: (migrations: readonly { name: string }[]) => Promise<string[]>; names: string[] } {
  const names: string[] = [];
  return {
    names,
    async run(migrations) {
      names.push(...migrations.map((migration) => migration.name));
      return migrations.map((migration) => migration.name);
    },
  };
}

afterEach(() => {
  delete process.env[BOOTSTRAP_TOKEN_VAR];
});

describe('amorçage — accès', () => {
  it('refuse tout amorçage quand la variable d’app est absente', async () => {
    const h = await createAcceptanceHarness();
    const outcome = await handleBootstrap(
      { method: 'POST', headers: { 'x-bootstrap-token': TOKEN }, body: bootstrapBody() },
      h.deps,
    );
    expect(outcome).toEqual({ statusCode: 403, outputKey: 'forbidden' });
  });

  it('refuse un jeton faux', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    const outcome = await handleBootstrap(
      { method: 'POST', headers: { 'x-bootstrap-token': 'x'.repeat(TOKEN.length) }, body: bootstrapBody() },
      h.deps,
    );
    expect(outcome.outputKey).toBe('forbidden');
  });

  it('refuse une méthode autre que POST', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    const outcome = await handleBootstrap({ method: 'GET', headers: {}, body: '' }, h.deps);
    expect(outcome).toEqual({ statusCode: 405, outputKey: 'method-not-allowed' });
  });
});

describe('amorçage — écritures', () => {
  it('applique le schéma SQL sur demande', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    const ddl = recordingDdl();
    const outcome = await handleBootstrap(
      { method: 'POST', headers: { 'x-bootstrap-token': TOKEN }, body: JSON.stringify({ action: 'migrate' }) },
      h.deps,
      ddl,
    );
    expect(outcome).toEqual({ statusCode: 200, outputKey: 'migrated' });
    expect(ddl.names).toHaveLength(12);
  });

  it('amorce un ticket vierge : critères, preuves, description réécrite', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    h.scenario.jira.addIssue(anIssue({ id: FRESH_ISSUE.id, key: FRESH_ISSUE.key, projectId: PROJECT_ID }));
    const outcome = await handleBootstrap(
      { method: 'POST', headers: { 'x-bootstrap-token': TOKEN }, body: bootstrapBody() },
      h.deps,
      recordingDdl(),
    );
    expect(outcome).toEqual({ statusCode: 200, outputKey: 'ok' });
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    expect(criteria.map((criterion) => criterion.code)).toEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
    expect(h.scenario.jira.rewrites.at(-1)?.issueId).toBe(FRESH_ISSUE.id);
  });

  it('répond 404 sur un ticket inconnu', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    const outcome = await handleBootstrap(
      { method: 'POST', headers: { 'x-bootstrap-token': TOKEN }, body: bootstrapBody('PAY-999') },
      h.deps,
      recordingDdl(),
    );
    expect(outcome).toEqual({ statusCode: 404, outputKey: 'not-found' });
  });

  it('refuse un corps illisible', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    const outcome = await handleBootstrap(
      { method: 'POST', headers: { 'x-bootstrap-token': TOKEN }, body: '{' },
      h.deps,
      recordingDdl(),
    );
    expect(outcome).toEqual({ statusCode: 400, outputKey: 'invalid-payload' });
  });

  it('lit l’action et le corps avant d’écrire', () => {
    expect(actionOf('{"action":"migrate"}')).toBe('migrate');
    expect(actionOf('{')).toBe('');
    expect(parseBootstrapBody('{"action":"autre"}')).toBeNull();
    const parsed = parseBootstrapBody(bootstrapBody(ISSUE_KEY));
    expect(parsed?.issueKey).toBe(ISSUE_KEY);
    expect(parsed?.cast.developer).toBe('user-developer');
  });
});
