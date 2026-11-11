import { describe, expect, it } from 'vitest';
import type { Route } from '@forge/api';
import {
  createEvidenceChecker,
  extractConfluencePageId,
  pageModifiedAt,
} from '../../src/collect/checker.js';
import type { HttpResponse } from '../../src/collect/http.js';

function mockCheckerTransport(opts: {
  confluence?: Record<string, unknown | HttpResponse>;
  jira?: Record<string, unknown | HttpResponse>;
  fetch?: Record<string, unknown | HttpResponse>;
}) {
  const reqConf = async (target: Route): Promise<HttpResponse> => {
    const raw = String(target.value ?? target);
    for (const [k, v] of Object.entries(opts.confluence ?? {})) {
      if (raw.includes(k)) {
        if (v && typeof (v as HttpResponse).status === 'number') return v as HttpResponse;
        return { ok: true, status: 200, json: async () => v };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const reqJira = async (target: Route): Promise<HttpResponse> => {
    const raw = String(target.value ?? target);
    for (const [k, v] of Object.entries(opts.jira ?? {})) {
      if (raw.includes(k)) {
        if (v && typeof (v as HttpResponse).status === 'number') return v as HttpResponse;
        return {
          ok: true,
          status: 200,
          json: async () => v,
          text: async () => (typeof v === 'string' ? v : JSON.stringify(v)),
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const extFetch = async (url: string): Promise<HttpResponse> => {
    for (const [k, v] of Object.entries(opts.fetch ?? {})) {
      if (url.includes(k)) {
        if (v && typeof (v as HttpResponse).status === 'number') return v as HttpResponse;
        return { ok: true, status: 200, json: async () => v };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  return { reqConf, reqJira, extFetch };
}

describe('extractConfluencePageId & pageModifiedAt', () => {
  it('extrait l id depuis une URL standard ou de query', () => {
    expect(extractConfluencePageId('https://site.atlassian.net/wiki/spaces/PAY/pages/12345/Doc')).toBe('12345');
    expect(extractConfluencePageId('https://site.atlassian.net/wiki/pages/viewpage.action?pageId=67890')).toBe('67890');
    expect(extractConfluencePageId('https://site.atlassian.net/wiki/x/short')).toBeNull();
  });

  it('lit la date de modification depuis payload version ou history', () => {
    expect(pageModifiedAt({ version: { createdAt: '2026-11-10T12:00:00Z' } })).toBe('2026-11-10T12:00:00Z');
    expect(pageModifiedAt({ history: { lastUpdated: '2026-11-09T08:00:00Z' } })).toBe('2026-11-09T08:00:00Z');
    expect(pageModifiedAt(null)).toBeNull();
  });
});

describe('EvidenceChecker - page Confluence', () => {
  it('valide une page existante et modifiée après since', async () => {
    const { reqConf } = mockCheckerTransport({
      confluence: {
        '/wiki/api/v2/pages/12345': {
          id: '12345',
          version: { createdAt: '2026-11-11T10:00:00Z' },
        },
      },
    });

    const checker = createEvidenceChecker({ requestConfluence: reqConf });
    const ok = await checker.documentationPage(
      'https://site.atlassian.net/wiki/spaces/PAY/pages/12345/Design',
      '2026-11-10T00:00:00Z',
    );
    expect(ok).toBe(true);
  });

  it('refuse une page dont la modification est antérieure à since', async () => {
    const { reqConf } = mockCheckerTransport({
      confluence: {
        '/wiki/api/v2/pages/12345': {
          version: { createdAt: '2026-11-01T00:00:00Z' },
        },
      },
    });
    const checker = createEvidenceChecker({ requestConfluence: reqConf });
    const ok = await checker.documentationPage(
      'https://site.atlassian.net/wiki/spaces/PAY/pages/12345/Design',
      '2026-11-10T00:00:00Z',
    );
    expect(ok).toBe(false);
  });

  it('refuse une page inexistante ou en erreur 404 sans crash', async () => {
    const { reqConf } = mockCheckerTransport({ confluence: {} });
    const checker = createEvidenceChecker({ requestConfluence: reqConf });
    const ok = await checker.documentationPage('https://site.atlassian.net/wiki/spaces/PAY/pages/999/Gone', '2026-11-01T00:00:00Z');
    expect(ok).toBe(false);
  });
});

describe('EvidenceChecker - pièce jointe', () => {
  it('valide la présence d une pièce jointe par son nom ou son id', async () => {
    const { reqJira } = mockCheckerTransport({
      jira: {
        '/rest/api/3/issue/PAY-123?fields=attachment': {
          fields: {
            attachment: [
              { id: '10042', filename: 'screenshot-payment.png' },
              { id: '10043', filename: 'report.pdf' },
            ],
          },
        },
      },
    });

    const checker = createEvidenceChecker({ requestJira: reqJira });
    expect(await checker.attachmentExists('PAY-123', 'screenshot-payment.png')).toBe(true);
    expect(await checker.attachmentExists('PAY-123', '10042')).toBe(true);
    expect(await checker.attachmentExists('PAY-123', 'missing.png')).toBe(false);
  });

  it('gère une erreur réseau ou un ticket sans attachement', async () => {
    const checker = createEvidenceChecker({
      requestJira: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    });
    expect(await checker.attachmentExists('PAY-123', 'file.png')).toBe(false);
  });
});

describe('EvidenceChecker - compte rendu d agent citant le critère', () => {
  it('valide une section de compte rendu citant le critère dans un commentaire', async () => {
    const { reqJira } = mockCheckerTransport({
      jira: {
        '/rest/api/3/issue/PAY-123?fields=attachment,comment': {
          fields: {
            attachment: [],
            comment: {
              comments: [
                {
                  id: 'c1',
                  body: 'Rapport agent Rovo : section validation. Le critère AC-2 est validé par test.',
                },
              ],
            },
          },
        },
      },
    });

    const checker = createEvidenceChecker({ requestJira: reqJira });
    const ok = await checker.reportSection('PAY-123', 'Rapport agent', 'AC-2');
    expect(ok).toBe(true);
  });

  it('refuse le compte rendu s il ne cite pas le critère', async () => {
    const { reqJira } = mockCheckerTransport({
      jira: {
        '/rest/api/3/issue/PAY-123?fields=attachment,comment': {
          fields: {
            comment: { comments: [{ id: 'c1', body: 'Rapport complet sans mention.' }] },
          },
        },
      },
    });
    const checker = createEvidenceChecker({ requestJira: reqJira });
    const ok = await checker.reportSection('PAY-123', 'Rapport', 'AC-3');
    expect(ok).toBe(false);
  });
});

describe('EvidenceChecker - lien joignable', () => {
  it('renvoie true quand le lien répond 200 à HEAD ou GET', async () => {
    const { extFetch } = mockCheckerTransport({
      fetch: { 'https://ci.company.com/build/123': { ok: true, status: 200 } },
    });
    const checker = createEvidenceChecker({ fetch: extFetch });
    expect(await checker.linkReachable('https://ci.company.com/build/123')).toBe(true);
  });

  it('renvoie false en cas d échec réseau ou URL invalide sans lever d exception', async () => {
    const checker = createEvidenceChecker({
      fetch: async () => {
        throw new Error('DNS lookup failure');
      },
    });
    expect(await checker.linkReachable('https://unreachable.domain.test')).toBe(false);
    expect(await checker.linkReachable('javascript:alert(1)')).toBe(false);
  });

  it('gère un délai dépassé sans lever d exception', async () => {
    const checker = createEvidenceChecker({
      timeoutMs: 10,
      fetch: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 100)),
    });
    expect(await checker.linkReachable('https://slow.test/link')).toBe(false);
  });
});

describe('EvidenceChecker - robustesse : réponse vide, erreur réseau, délai dépassé', () => {
  const brokenRequest = async (): Promise<HttpResponse> => {
    throw new Error('egress non autorisé');
  };
  const hangingRequest = (): Promise<HttpResponse> =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 200),
    );

  const PAGE = 'https://site.atlassian.net/wiki/spaces/PAY/pages/12345/Design';

  it('documentationPage renvoie false sur URL sans identifiant de page', async () => {
    const checker = createEvidenceChecker({ requestConfluence: brokenRequest });
    expect(await checker.documentationPage('https://site.atlassian.net/wiki/x/AbCd', '2026-11-01T00:00:00Z')).toBe(false);
    expect(await checker.documentationPage('', '2026-11-01T00:00:00Z')).toBe(false);
  });

  it('documentationPage renvoie false sur erreur réseau ou corps illisible', async () => {
    const broken = createEvidenceChecker({ requestConfluence: brokenRequest });
    expect(await broken.documentationPage(PAGE, '2026-11-01T00:00:00Z')).toBe(false);

    const garbage = createEvidenceChecker({
      requestConfluence: async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }),
    });
    expect(await garbage.documentationPage(PAGE, '2026-11-01T00:00:00Z')).toBe(false);
  });

  it('documentationPage accepte une page sans date de borne inférieure', async () => {
    const { reqConf } = mockCheckerTransport({
      confluence: { '/wiki/api/v2/pages/12345': { id: '12345' } },
    });
    const checker = createEvidenceChecker({ requestConfluence: reqConf });
    expect(await checker.documentationPage(PAGE, '')).toBe(true);
  });

  it('attachmentExists renvoie false sur réponse vide ou erreur réseau', async () => {
    const broken = createEvidenceChecker({ requestJira: brokenRequest });
    expect(await broken.attachmentExists('PAY-123', 'file.png')).toBe(false);

    const { reqJira } = mockCheckerTransport({
      jira: { '/rest/api/3/issue/PAY-123?fields=attachment': { fields: {} } },
    });
    const empty = createEvidenceChecker({ requestJira: reqJira });
    expect(await empty.attachmentExists('PAY-123', 'file.png')).toBe(false);
    expect(await empty.attachmentExists('', 'file.png')).toBe(false);
  });

  it('reportSection renvoie false sur erreur réseau, référence vide ou critère vide', async () => {
    const broken = createEvidenceChecker({ requestJira: brokenRequest });
    expect(await broken.reportSection('PAY-123', 'rapport', 'AC-1')).toBe(false);

    const { reqJira } = mockCheckerTransport({
      jira: { '/rest/api/3/issue/PAY-123?fields=attachment,comment': { fields: {} } },
    });
    const checker = createEvidenceChecker({ requestJira: reqJira });
    expect(await checker.reportSection('PAY-123', 'rapport', '')).toBe(false);
    expect(await checker.reportSection('', 'rapport', 'AC-1')).toBe(false);
  });

  it('borne l attente : un transport Confluence qui pend ne bloque jamais', async () => {
    const checker = createEvidenceChecker({ timeoutMs: 5, requestConfluence: hangingRequest });
    expect(await checker.documentationPage(PAGE, '2026-11-01T00:00:00Z')).toBe(false);
  });

  it('borne l attente : un transport Jira qui pend ne bloque jamais', async () => {
    const checker = createEvidenceChecker({ timeoutMs: 5, requestJira: hangingRequest });
    expect(await checker.attachmentExists('PAY-123', 'file.png')).toBe(false);
    expect(await checker.reportSection('PAY-123', 'rapport', 'AC-1')).toBe(false);
  });

  it('accepte un lien qui ne répond qu au GET et pas au HEAD', async () => {
    let calls = 0;
    const checker = createEvidenceChecker({
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? { ok: false, status: 405, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => ({}) };
      },
    });
    expect(await checker.linkReachable('https://ci.company.com/build/7')).toBe(true);
    expect(calls).toBe(2);
  });
});
