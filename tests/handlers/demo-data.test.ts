/**
 * Le web trigger `demo-data` : lecture publique pseudonymisée, amorçage jetonné.
 *
 * Rejoué sur le harnais d'acceptation (vrais modules, doubles en mémoire) :
 * ces tests prouvent à la fois le handler et le contrat consommé par le site
 * public (`site/src/demo/remote.ts`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_TOKEN_VAR,
  CORS_HEADERS,
  handleDemoData,
  parseBootstrapBody,
} from '../../src/handlers/demo-data';
import type { DemoSnapshotData } from '../../src/demo-snapshot';
import { createAcceptanceHarness, ISSUE_KEY, PROJECT_ID } from '../acceptance/harness';
import { anIssue } from '../helpers/builders';
import type { CiWebRequest } from '../../src/handlers/ingest';

const TOKEN = 'jeton-d-amorcage-de-test';
const FRESH_ISSUE = { id: '20001', key: 'PAY-900' };

/** Requête de web trigger minimale. */
function request(partial: Partial<CiWebRequest>): CiWebRequest {
  return { method: 'GET', path: '', headers: {}, body: '', query: {}, ...partial };
}

function bootstrapBody(ciKey: string): string {
  return JSON.stringify({
    action: 'bootstrap',
    issueKey: FRESH_ISSUE.key,
    ciKey,
    cast: { developer: 'user-developer', tester: 'user-tester', owner: 'user-owner' },
  });
}

afterEach(() => {
  delete process.env[BOOTSTRAP_TOKEN_VAR];
});

describe('demo-data — lecture publique', () => {
  it('répond 204 aux pré-requêtes CORS', async () => {
    const h = await createAcceptanceHarness();
    const response = await handleDemoData(request({ method: 'OPTIONS' }), h.deps);
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('refuse une lecture sans ticket demandé', async () => {
    const h = await createAcceptanceHarness();
    const response = await handleDemoData(request({ query: {} }), h.deps);
    expect(response.statusCode).toBe(400);
  });

  it('répond 404 sur un ticket inconnu', async () => {
    const h = await createAcceptanceHarness();
    const response = await handleDemoData(request({ query: { issueKey: 'PAY-999' } }), h.deps);
    expect(response.statusCode).toBe(404);
  });

  it('sert l’état réel du ticket, avec les en-têtes CORS', async () => {
    const h = await createAcceptanceHarness();
    await h.recompute();
    const response = await handleDemoData(request({ query: { issueKey: ISSUE_KEY } }), h.deps);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/json');
    expect(response.headers['cache-control']).toBe(CORS_HEADERS['cache-control']);
    const snapshot = JSON.parse(response.body) as DemoSnapshotData;
    expect(snapshot.issue.key).toBe(ISSUE_KEY);
    expect(snapshot.criteria).toHaveLength(4);
    expect(snapshot.coverage?.proven).toBe(2);
    expect(snapshot.coverage?.total).toBe(4);
    expect(snapshot.actors.length).toBeGreaterThan(0);
  });

  it('ne laisse sortir ni identifiant de compte ni clé de CI', async () => {
    const h = await createAcceptanceHarness();
    await h.recompute();
    const response = await handleDemoData(request({ query: { issueKey: ISSUE_KEY } }), h.deps);
    const snapshot = JSON.parse(response.body) as DemoSnapshotData;
    expect(snapshot.settings.ciKeyHash).toBe('');
    const comptes = Object.values(h.scenario.actors).map((actor) => actor.accountId);
    for (const compte of comptes) expect(response.body).not.toContain(compte);
    expect(snapshot.issue.assigneeRef).toMatch(/^actor-\d+$/);
  });

  it('verrouille la forme du contrat consommé par le site', async () => {
    const h = await createAcceptanceHarness();
    await h.recompute();
    const response = await handleDemoData(request({ query: { issueKey: ISSUE_KEY } }), h.deps);
    expect(Object.keys(JSON.parse(response.body) as object).sort()).toEqual([
      'actors',
      'attestations',
      'ci',
      'coverage',
      'criteria',
      'dossier',
      'evidences',
      'generatedAt',
      'issue',
      'living',
      'project',
      'settings',
      'site',
      'stats',
      'waivers',
    ]);
  });
});

describe('demo-data — amorçage protégé', () => {
  it('refuse tout amorçage quand la variable d’app est absente', async () => {
    const h = await createAcceptanceHarness();
    const response = await handleDemoData(
      request({ method: 'POST', body: bootstrapBody('cle'), headers: { 'x-bootstrap-token': TOKEN } }),
      h.deps,
    );
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'bootstrap-disabled' });
  });

  it('refuse un jeton faux, même de la même longueur', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    const response = await handleDemoData(
      request({
        method: 'POST',
        body: bootstrapBody('cle'),
        headers: { 'x-bootstrap-token': 'x'.repeat(TOKEN.length) },
      }),
      h.deps,
    );
    expect(response.statusCode).toBe(403);
  });

  it('amorce un ticket vierge : critères, preuves déclarées, description réécrite', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    h.scenario.jira.addIssue(
      anIssue({ id: FRESH_ISSUE.id, key: FRESH_ISSUE.key, projectId: PROJECT_ID, description: '' }),
    );
    const response = await handleDemoData(
      request({ method: 'POST', body: bootstrapBody('cle-ci-reelle'), headers: { 'x-bootstrap-token': TOKEN } }),
      h.deps,
    );
    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body) as { created: boolean; criteria: string[]; coverage: { proven: number; total: number } };
    expect(result.created).toBe(true);
    expect(result.criteria).toEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
    // Les deux preuves de test partent déclarées : rien n'est prouvé avant la CI.
    expect(result.coverage).toEqual({ proven: 0, total: 4 });
    expect(h.scenario.jira.rewrites.at(-1)?.issueId).toBe(FRESH_ISSUE.id);
  });

  it('est idempotent : un ticket déjà amorcé n’est pas recréé', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await createAcceptanceHarness();
    h.scenario.jira.addIssue(anIssue({ id: FRESH_ISSUE.id, key: FRESH_ISSUE.key, projectId: PROJECT_ID }));
    const post = request({ method: 'POST', body: bootstrapBody('cle'), headers: { 'x-bootstrap-token': TOKEN } });
    await handleDemoData(post, h.deps);
    const second = await handleDemoData(post, h.deps);
    expect((JSON.parse(second.body) as { created: boolean }).created).toBe(false);
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    expect(criteria).toHaveLength(4);
  });

  it('valide la forme du corps avant d’écrire', () => {
    expect(parseBootstrapBody('{')).toBeNull();
    expect(parseBootstrapBody(JSON.stringify({ action: 'wipe' }))).toBeNull();
    expect(
      parseBootstrapBody(JSON.stringify({ action: 'bootstrap', issueKey: 'PAY-1', ciKey: 'k', cast: { developer: 'a', tester: 'b', owner: 'c' } })),
    ).not.toBeNull();
  });
});
