/**
 * La lecture de l'historique de statuts (SPEC §14 FP-18).
 *
 * Un seul appel pour tout le projet, `expand: "changelog"` demandé dans le
 * corps de la recherche ; toute erreur rend une liste vide.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { RequestInit, Route } from '@forge/api';
import { createJiraGateway } from '../../src/collect/jira.js';
import type { HttpResponse } from '../../src/collect/http.js';

interface RequestLog {
  url: string;
  method?: string;
  body?: unknown;
}

/** Un transport qui répond le corps donné, et note ce qu'il a reçu. */
function mockTransport(responses: Record<string, unknown | HttpResponse>) {
  const log: RequestLog[] = [];
  const requestJira = async (target: Route, init?: RequestInit): Promise<HttpResponse> => {
    const rawTarget = String(target.value ?? target);
    let body: unknown;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    log.push({ url: rawTarget, method: init?.method ?? 'GET', body });
    for (const [pattern, res] of Object.entries(responses)) {
      if (!rawTarget.includes(pattern)) continue;
      if (res && typeof (res as HttpResponse).status === 'number') return res as HttpResponse;
      return { ok: true, status: 200, json: async () => res };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { requestJira, log };
}

describe('statusHistories — les réouvertures lues en un seul appel', () => {
  it('lit le changelog via expand, et reconstruit les transitions de statut', async () => {
    const { requestJira, log } = mockTransport({
      '/rest/api/3/search/jql': {
        issues: [
          {
            id: '10001',
            key: 'PAY-123',
            fields: { status: { name: 'Done' } },
            changelog: {
              histories: [
                {
                  items: [
                    { field: 'status', fromString: 'To Do', toString: 'Done' },
                    { field: 'priority', fromString: 'Medium', toString: 'High' },
                  ],
                },
                { items: [{ field: 'status', fromString: 'Done', toString: 'To Do' }] },
              ],
            },
          },
        ],
      },
    });

    const jira = createJiraGateway({ requestJira });
    const histories = await jira.statusHistories('PAY');

    expect(histories).toHaveLength(1);
    expect(histories[0]?.issueKey).toBe('PAY-123');
    expect(histories[0]?.currentStatus).toBe('Done');
    // Seuls les changements de statut comptent, dans l'ordre.
    expect(histories[0]?.transitions).toEqual([
      { from: 'To Do', to: 'Done' },
      { from: 'Done', to: 'To Do' },
    ]);
    // Un seul appel, avec l'expansion du changelog demandée dans le corps.
    expect(log).toHaveLength(1);
    expect(log[0]?.body).toMatchObject({ expand: 'changelog' });
    expect(String((log[0]?.body as { jql: string }).jql)).toContain('project = "PAY"');
  });

  it('rend une liste vide quand la recherche échoue, sans lever', async () => {
    const { requestJira } = mockTransport({ '/rest/api/3/nothing': {} });
    const jira = createJiraGateway({ requestJira });
    await expect(jira.statusHistories('PAY')).resolves.toEqual([]);
  });

  it('rend une liste vide sans projet', async () => {
    const { requestJira, log } = mockTransport({ '/rest/api/3/search/jql': { issues: [] } });
    const jira = createJiraGateway({ requestJira });
    await expect(jira.statusHistories('')).resolves.toEqual([]);
    expect(log).toHaveLength(0);
  });
});
