/**
 * Tests du web trigger d'ingestion de résultats de CI (SPEC §10, §17, FP-06).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { handleCiResults } from '../../src/handlers/ingest.js';
import { BatchReassembler } from '../../src/ingest/batching.js';
import { MAX_BODY_BYTES, processCiWebRequest } from '../../src/ingest/webtrigger.js';
import { BRANCH, COMMIT, PROJECT_ID, REPO, aCiSummary } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';
import { CI_KEY_HASH, NOW_ISO, depsFromScenario, signedRequest } from './ci-deps.js';

describe('webtrigger — handleCiResults', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario(NOW_ISO);
    await scenario.store.saveSettings({ ...scenario.project, ciKeyHash: CI_KEY_HASH });
  });

  it('accepte une requête valide et la publie sur la file proof-ci', async () => {
    const summary = aCiSummary();
    const body = JSON.stringify(summary);
    const request = signedRequest(body);
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);

    expect(response.statusCode).toBe(202);
    const parsed = JSON.parse(response.body);
    expect(parsed.status).toBe('accepted');
    expect(parsed.runId).toBeDefined();

    // La file a reçu le message d'ingestion (SPEC §17, point 1)
    expect(scenario.queue.published).toHaveLength(1);
    expect(scenario.queue.published[0].runId).toBe(parsed.runId);
    expect(scenario.queue.published[0].summary.branch).toBe(summary.branch);
  });

  it('refuse toute méthode autre que POST', async () => {
    const request = signedRequest('{}', { method: 'GET' });
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);
    expect(response.statusCode).toBe(405);
  });

  it('refuse une charge utile qui dépasse 5 Mo', async () => {
    const oversizedBody = 'x'.repeat(MAX_BODY_BYTES + 10);
    const request = signedRequest(oversizedBody);
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);
    expect(response.statusCode).toBe(413);
  });

  it('refuse si les en-têtes d’authentification sont absents', async () => {
    const request = signedRequest('{}');
    delete request.headers['x-ci-key'];
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);
    expect(response.statusCode).toBe(401);
  });

  it('refuse une clé dont l’empreinte n’appartient à aucun projet', async () => {
    const request = signedRequest('{}', { key: 'cle-inconnue' });
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);
    expect(response.statusCode).toBe(401);
  });

  it('refuse un horodatage hors de la fenêtre anti-rejeu', async () => {
    const oldTimestamp = String(Math.floor(Date.parse(NOW_ISO) / 1000) - 3600);
    const body = JSON.stringify(aCiSummary());
    const request = signedRequest(body, { timestamp: oldTimestamp });
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toBe('ci.ingest.replay_rejected');
  });

  it('refuse un corps JSON mal formé', async () => {
    const body = 'ceci n est pas du json';
    const request = signedRequest(body);
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(request, deps);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('ci.ingest.invalid_payload');
  });

  it('met en attente un lot partiel et ne publie qu’à la fin', async () => {
    const localReassembler = new BatchReassembler();
    const deps = depsFromScenario(scenario);
    const summary = aCiSummary();

    const batch1 = { runId: 'run-batch-1', index: 0, total: 2, summary: { ...summary, tests: [] } };
    const batch2 = { runId: 'run-batch-1', index: 1, total: 2, summary };

    // Premier lot : mis en attente, rien sur la file
    const req1 = signedRequest(JSON.stringify(batch1));
    const res1 = await processCiWebRequest(req1, deps, localReassembler);
    expect(res1.statusCode).toBe(202);
    expect(JSON.parse(res1.body).status).toBe('buffered');
    expect(scenario.queue.published).toHaveLength(0);

    // Deuxième lot : assemblage complet, publication sur la file
    const req2 = signedRequest(JSON.stringify(batch2));
    const res2 = await processCiWebRequest(req2, deps, localReassembler);
    expect(res2.statusCode).toBe(202);
    expect(JSON.parse(res2.body).status).toBe('accepted');
    expect(scenario.queue.published).toHaveLength(1);
  });

  it('ne laisse entrer ni journal ni champ inconnu (SPEC §20)', async () => {
    const body = JSON.stringify({
      ...aCiSummary({ mainBranch: true }),
      logs: 'sortie complète du pipeline',
      tests: [
        { name: 'test A', state: 'passed', durationMs: 12, stdout: 'bruit', trace: 'pile' },
        { name: 'test B', state: 'état-inconnu' },
      ],
    });
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(signedRequest(body), deps);

    expect(response.statusCode).toBe(202);
    const published = scenario.queue.published[0].summary;
    expect(published.mainBranch).toBe(true);
    expect(Object.keys(published).sort()).toEqual([
      'branch',
      'commit',
      'mainBranch',
      'receivedAt',
      'repo',
      'tests',
    ]);
    expect(Object.keys(published.tests[0]).sort()).toEqual(['durationMs', 'name', 'state']);
    // Un état illisible est lu comme « absent » : le doute fait tomber la preuve.
    expect(published.tests[1].state).toBe('absent');
    expect(published.tests[1].durationMs).toBe(0);
  });

  it('horodate le résumé avec l’horloge injectée quand l’émetteur ne le fait pas', async () => {
    const body = JSON.stringify({ repo: REPO, branch: BRANCH, commit: COMMIT, tests: [] });
    const deps = depsFromScenario(scenario);

    await handleCiResults(signedRequest(body), deps);

    expect(scenario.queue.published[0].summary.receivedAt).toBe(NOW_ISO);
  });

  it('répond dans la langue du projet', async () => {
    await scenario.store.saveSettings({ ...scenario.project, ciKeyHash: CI_KEY_HASH, language: 'fr' });
    const body = 'pas-du-json';
    const deps = depsFromScenario(scenario);

    const response = await handleCiResults(signedRequest(body), deps);

    expect(JSON.parse(response.body).message).toContain('invalide');
  });

  it('publie le projet retrouvé par l’empreinte de la clé (SPEC §10)', async () => {
    const body = JSON.stringify(aCiSummary());
    const deps = depsFromScenario(scenario);

    await handleCiResults(signedRequest(body), deps);

    expect(scenario.queue.published[0].projectId).toBe(PROJECT_ID);
    expect(scenario.queue.published[0].runId.length).toBeGreaterThan(0);
  });

  it('conserve l’information « branche principale » qui pilote la preuve vivante', async () => {
    const body = JSON.stringify(aCiSummary({ branch: 'main', mainBranch: true }));
    const deps = depsFromScenario(scenario);

    await handleCiResults(signedRequest(body), deps);

    expect(scenario.queue.published[0].summary.mainBranch).toBe(true);
  });
});
