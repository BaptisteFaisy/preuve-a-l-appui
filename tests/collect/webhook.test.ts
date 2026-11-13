/**
 * L'adaptateur de notification hors Jira (Slack / Teams / Discord).
 *
 * Ce qui se prouve ici :
 *  - pas de variable d'environnement → **aucun appel**, aucune erreur ;
 *  - une URL configurée → un POST `{"text": "…"}`, format accepté par les
 *    trois canaux, sur le transport injecté (aucun socket ouvert) ;
 *  - un canal lent, une panne réseau ou un non-2xx → `false`, jamais une
 *    exception : une notification ratée ne casse pas un résumé de CI.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  NOTIFY_WEBHOOK_VAR,
  WEBHOOK_TIMEOUT_MS,
  createWebhookNotifier,
  isWebhookConfigured,
  webhookPayload,
  webhookUrl,
} from '../../src/collect/webhook.js';
import type { ExternalFetch, HttpResponse } from '../../src/collect/http.js';

/** Un transport espion : aucune requête ne sort, tout est enregistré. */
function spyTransport(response: HttpResponse | 'throw' | 'hang') {
  const calls: { url: string; init?: { method?: string; body?: unknown } }[] = [];
  const fetchImpl: ExternalFetch = async (url, init) => {
    calls.push({ url, ...(init ? { init: { method: init.method, body: init.body } } : {}) });
    if (response === 'throw') throw new Error('réseau coupé');
    if (response === 'hang') return new Promise<never>(() => {});
    return response;
  };
  return { calls, fetchImpl };
}

const ok = (status = 200, isOk = true): HttpResponse => ({
  ok: isOk,
  status,
  json: async () => ({ ok: true }),
});

afterEach(() => {
  delete process.env[NOTIFY_WEBHOOK_VAR];
});

describe('variable d’environnement', () => {
  it('le nom est explicite et préfixé comme les autres variables d’app', () => {
    expect(NOTIFY_WEBHOOK_VAR).toBe('FORGE_USER_VAR_NOTIFY_WEBHOOK');
  });

  it('absente ou vide : rien n’est configuré', () => {
    delete process.env[NOTIFY_WEBHOOK_VAR];
    expect(webhookUrl()).toBe('');
    expect(isWebhookConfigured()).toBe(false);
    process.env[NOTIFY_WEBHOOK_VAR] = '   ';
    expect(webhookUrl()).toBe('');
    expect(isWebhookConfigured()).toBe(false);
  });

  it('présente : l’URL est lue, espaces retirés', () => {
    process.env[NOTIFY_WEBHOOK_VAR] = ' https://hooks.slack.com/services/T/B/X ';
    expect(webhookUrl()).toBe('https://hooks.slack.com/services/T/B/X');
    expect(isWebhookConfigured()).toBe(true);
  });
});

describe('createWebhookNotifier — envoi', () => {
  it('`enabled` dit si un canal est configuré', () => {
    expect(createWebhookNotifier({ url: '' }).enabled).toBe(false);
    expect(createWebhookNotifier({ url: 'https://hooks.slack.com/services/T/B/X' }).enabled).toBe(true);
    delete process.env[NOTIFY_WEBHOOK_VAR];
    expect(createWebhookNotifier().enabled).toBe(false);
    process.env[NOTIFY_WEBHOOK_VAR] = ' https://discord.com/api/webhooks/1/2 ';
    expect(createWebhookNotifier().enabled).toBe(true);
  });

  it('sans URL : aucun appel, aucun échec', async () => {
    const spy = spyTransport(ok());
    const notifier = createWebhookNotifier({
      url: '',
      fetchImpl: spy.fetchImpl,
      timeoutMs: WEBHOOK_TIMEOUT_MS,
    });
    await expect(notifier.send({ text: 'bonjour', issueKey: 'PAY-123' })).resolves.toBe(false);
    expect(spy.calls).toHaveLength(0);
  });

  it('sans URL dans l’environnement : aucun appel non plus', async () => {
    delete process.env[NOTIFY_WEBHOOK_VAR];
    const spy = spyTransport(ok());
    const notifier = createWebhookNotifier({ fetchImpl: spy.fetchImpl });
    await expect(notifier.send({ text: 'bonjour', issueKey: 'PAY-123' })).resolves.toBe(false);
    expect(spy.calls).toHaveLength(0);
  });

  it('envoie `{"text": "…"}` en POST — le format des trois canaux', async () => {
    const spy = spyTransport(ok());
    const notifier = createWebhookNotifier({
      url: 'https://hooks.slack.com/services/T/B/X',
      fetchImpl: spy.fetchImpl,
    });
    await expect(notifier.send({ text: 'Alerte PAY-123', issueKey: 'PAY-123' })).resolves.toBe(true);
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0]?.url).toBe('https://hooks.slack.com/services/T/B/X');
    expect(spy.calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(spy.calls[0]?.init?.body ?? '{}'))).toEqual({ text: 'Alerte PAY-123' });
  });

  it('le corps est exactement la forme attendue par Slack, Teams et Discord', () => {
    expect(webhookPayload('x')).toEqual({ text: 'x' });
  });

  it('un message vide n’envoie rien', async () => {
    const spy = spyTransport(ok());
    const notifier = createWebhookNotifier({ url: 'https://discord.com/api/webhooks/1/2', fetchImpl: spy.fetchImpl });
    await expect(notifier.send({ text: '   ', issueKey: 'PAY-123' })).resolves.toBe(false);
    expect(spy.calls).toHaveLength(0);
  });
});

describe('createWebhookNotifier — tolérance aux erreurs', () => {
  it('un non-2xx rend false, sans exception', async () => {
    const notifier = createWebhookNotifier({
      url: 'https://outlook.office.com/webhook/x',
      fetchImpl: spyTransport(ok(500, false)).fetchImpl,
    });
    await expect(notifier.send({ text: 'coucou', issueKey: 'PAY-123' })).resolves.toBe(false);
  });

  it('une erreur réseau rend false, sans exception', async () => {
    const notifier = createWebhookNotifier({
      url: 'https://hooks.slack.com/services/T/B/X',
      fetchImpl: spyTransport('throw').fetchImpl,
    });
    await expect(notifier.send({ text: 'coucou', issueKey: 'PAY-123' })).resolves.toBe(false);
  });

  it('un canal qui ne répond pas est borné dans le temps', async () => {
    const notifier = createWebhookNotifier({
      url: 'https://hooks.slack.com/services/T/B/X',
      fetchImpl: spyTransport('hang').fetchImpl,
      timeoutMs: 20,
    });
    const started = Date.now();
    await expect(notifier.send({ text: 'coucou', issueKey: 'PAY-123' })).resolves.toBe(false);
    // La borne tient : un canal muet ne retient pas le consommateur de CI.
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
