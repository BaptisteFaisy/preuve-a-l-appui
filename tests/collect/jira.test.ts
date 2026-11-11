import { describe, expect, it } from 'vitest';
import type { RequestInit, Route } from '@forge/api';
import {
  COVERAGE_GATE_PROPERTY,
  COVERAGE_LABEL_PROPERTY,
  createJiraGateway,
  extractIssueKeyFromBranch,
  jqlValue,
  roleIdFromUrl,
  toIssueRef,
} from '../../src/collect/jira.js';
import {
  adfTextOf,
  adfToPlainText,
  replaceCriteriaInAdf,
  replaceCriteriaInText,
  splitSection,
} from '../../src/collect/jira-adf.js';
import type { HttpResponse } from '../../src/collect/http.js';

interface RequestLog {
  url: string;
  method?: string;
  body?: unknown;
}

function mockTransport(responses: Record<string, unknown | HttpResponse>) {
  const log: RequestLog[] = [];
  // Le motif le plus long gagne : `/project/PAY/role` ne doit pas masquer
  // `/project/PAY/role/1001`.
  const patterns = Object.entries(responses).sort((a, b) => b[0].length - a[0].length);
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
    for (const [pattern, res] of patterns) {
      if (rawTarget.includes(pattern)) {
        if (res && typeof (res as HttpResponse).status === 'number') {
          return res as HttpResponse;
        }
        return {
          ok: true,
          status: 200,
          json: async () => res,
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { requestJira, log };
}

describe('extractIssueKeyFromBranch', () => {
  it('extrait la clé Jira depuis un nom de branche git classique', () => {
    expect(extractIssueKeyFromBranch('feature/PAY-123-card-payment')).toBe('PAY-123');
    expect(extractIssueKeyFromBranch('fix/PROJ-42')).toBe('PROJ-42');
    expect(extractIssueKeyFromBranch('ABC-1')).toBe('ABC-1');
  });

  it('renvoie null si la branche ne contient aucune clé Jira', () => {
    expect(extractIssueKeyFromBranch('main')).toBeNull();
    expect(extractIssueKeyFromBranch('fix/refactoring-without-ticket')).toBeNull();
  });
});

describe('helpers purs de l adaptateur Jira', () => {
  it('échappe une valeur de JQL en retirant guillemets et antislashs', () => {
    expect(jqlValue('PAY')).toBe('"PAY"');
    expect(jqlValue('a"b\\c')).toBe('"abc"');
  });

  it('lit l identifiant de rôle dans l URL de la carte des rôles', () => {
    expect(roleIdFromUrl('https://jira.test/rest/api/3/project/PAY/role/1001')).toBe('1001');
    expect(roleIdFromUrl('https://jira.test/rest/api/3/project/PAY')).toBeNull();
    expect(roleIdFromUrl('')).toBeNull();
  });

  it('construit un IssueRef complet depuis un payload Jira minimal', () => {
    const issue = toIssueRef({ id: '9', key: 'PAY-9', fields: { summary: 'S' } });
    expect(issue).toMatchObject({ id: '9', key: 'PAY-9', summary: 'S', status: '' });
    expect(issue.components).toEqual([]);
    expect(issue.children).toEqual([]);
  });

  it('construit un IssueRef vide depuis un payload sans champs', () => {
    const issue = toIssueRef({});
    expect(issue.id).toBe('');
    expect(issue.description).toBe('');
  });

  it('lit le texte d un nœud ADF et d une chaîne', () => {
    expect(adfTextOf({ type: 'text', text: 'Bonjour' })).toBe('Bonjour');
    expect(adfTextOf({ type: 'paragraph', content: [{ type: 'text', text: 'A' }] })).toBe('A');
    expect(adfTextOf(null)).toBe('');
  });

  it('découpe une section : titre Markdown puis lignes de corps', () => {
    expect(splitSection('## Critères\n- AC-1\n- AC-2')).toEqual({
      heading: 'Critères',
      body: ['- AC-1', '- AC-2'],
    });
    expect(splitSection('- AC-1')).toEqual({ heading: null, body: ['- AC-1'] });
    expect(splitSection('')).toEqual({ heading: null, body: [] });
  });

  it('remplace la section critères d un document ADF sans toucher au reste', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Avant' }] },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: "Critères d'acceptation" }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Vieux' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Après' }] },
      ],
    };

    const updated = replaceCriteriaInAdf(doc, "- AC-1 Neuf");
    const text = adfToPlainText(updated);
    expect(text).toContain('Avant');
    expect(text).toContain('Après');
    expect(text).toContain('AC-1 Neuf');
    expect(text).not.toContain('Vieux');
    // Le titre déjà en place est conservé : aucune chaîne visible inventée ici.
    expect(text).toContain("Critères d'acceptation");
  });

  it('ajoute la section critères quand le document n en contient pas', () => {
    const updated = replaceCriteriaInAdf(null, '## Critères\n- AC-1');
    expect(adfToPlainText(updated)).toContain('AC-1');
    expect(updated.content).toHaveLength(2);
  });
});

describe('JiraGateway - lecture de tickets', () => {
  it('lit un ticket nominal et convertit les champs nécessaires', async () => {
    const { requestJira } = mockTransport({
      '/rest/api/3/issue/PAY-123': {
        id: '10001',
        key: 'PAY-123',
        fields: {
          summary: 'Paiement carte',
          description: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
          },
          status: { name: 'En cours' },
          project: { id: 'proj-1', key: 'PAY' },
          assignee: { accountId: 'user-1' },
          reporter: { accountId: 'user-2' },
          components: [{ name: 'frontend' }],
          fixVersions: [{ name: '1.0.0' }],
          subtasks: [{ key: 'PAY-124' }],
        },
      },
    });

    const jira = createJiraGateway({ requestJira });
    const issue = await jira.getIssue('PAY-123');

    expect(issue).not.toBeNull();
    expect(issue?.key).toBe('PAY-123');
    expect(issue?.summary).toBe('Paiement carte');
    expect(issue?.status).toBe('En cours');
    expect(issue?.description).toBe('Hello');
    expect(issue?.components).toEqual(['frontend']);
    expect(issue?.fixVersions).toEqual(['1.0.0']);
    expect(issue?.children).toEqual(['PAY-124']);
  });

  it('renvoie null quand le ticket est introuvable ou erreur 404', async () => {
    const { requestJira } = mockTransport({});
    const jira = createJiraGateway({ requestJira });
    const issue = await jira.getIssue('NOTFOUND-999');
    expect(issue).toBeNull();
  });

  it('gère les réponses vides sans exception', async () => {
    const jira = createJiraGateway({
      requestJira: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    });
    expect(await jira.getIssue('')).toBeNull();
    expect(await jira.getIssue('PAY-123')).toBeNull();
  });

  it('retrouve un ticket par la branche', async () => {
    const { requestJira } = mockTransport({
      '/rest/api/3/issue/PAY-123': {
        id: '10001',
        key: 'PAY-123',
        fields: {
          project: { id: '10000', key: 'PAY' },
          summary: 'Ticket trouvé',
        },
      },
    });
    const jira = createJiraGateway({ requestJira });
    const issue = await jira.findIssueByBranch('PAY', 'feat/PAY-123-ui');
    expect(issue?.key).toBe('PAY-123');
  });

  it('refuse le ticket si le projet ne correspond pas', async () => {
    const { requestJira } = mockTransport({
      '/rest/api/3/issue/PAY-123': {
        id: '10001',
        key: 'PAY-123',
        fields: { project: { id: '20000', key: 'OTHER' } },
      },
    });
    const jira = createJiraGateway({ requestJira });
    const issue = await jira.findIssueByBranch('PAY', 'feat/PAY-123-ui');
    expect(issue).toBeNull();
  });
});

describe('JiraGateway - liste tickets version', () => {
  it('liste les tickets associés à une fixVersion via searchJql', async () => {
    const { requestJira, log } = mockTransport({
      '/rest/api/3/search/jql': {
        issues: [
          { id: '1', key: 'PAY-1', fields: { summary: 'Un' } },
          { id: '2', key: 'PAY-2', fields: { summary: 'Deux' } },
        ],
      },
    });
    const jira = createJiraGateway({ requestJira });
    const issues = await jira.listIssuesOfVersion('PAY', '10001');
    expect(issues).toHaveLength(2);
    expect(issues[0]!.key).toBe('PAY-1');
    expect(log[0]!.url).toContain('/rest/api/3/search/jql');
  });

  it('renvoie une liste vide quand projectId ou versionId est vide', async () => {
    const jira = createJiraGateway();
    expect(await jira.listIssuesOfVersion('', '10001')).toEqual([]);
    expect(await jira.listIssuesOfVersion('PAY', '')).toEqual([]);
  });
});

describe('JiraGateway - réécriture de description ADF & texte', () => {
  it('ne remplace que la section critères en ADF en préservant le reste', async () => {
    const originalDoc = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Contexte introductif' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: "Critères d'acceptation" }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Ancien critère' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes techniques' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Reste inchangé' }] },
      ],
    };

    const { requestJira, log } = mockTransport({
      '/rest/api/3/issue/PAY-123?fields=description': {
        id: '10001',
        key: 'PAY-123',
        fields: { description: originalDoc },
      },
      '/rest/api/3/issue/PAY-123': { ok: true, status: 200, json: async () => ({}) },
    });

    const jira = createJiraGateway({ requestJira });
    const newSection = '- AC-1 : Nouveau critère';
    const ok = await jira.rewriteDescriptionSection('PAY-123', newSection);
    expect(ok).toBe(true);

    const putCall = log.find((l) => l.method === 'PUT');
    expect(putCall).toBeDefined();
    const payload = putCall?.body as { fields?: { description?: { content?: unknown[] } } };
    expect(payload.fields?.description?.content).toBeDefined();
    const textOut = adfToPlainText(payload.fields?.description);
    expect(textOut).toContain('Contexte introductif');
    expect(textOut).toContain('AC-1 : Nouveau critère');
    expect(textOut).toContain('Reste inchangé');
  });

  it('remplace la section critères en texte brut si la description est une chaîne', async () => {
    const initialText = 'Intro\n\n## Critères d\'acceptation\n- Vieux critère\n\n## Déploiement\n- Étape 1';
    const replaced = replaceCriteriaInText(initialText, '- AC-1 Tout neuf');
    expect(replaced).toContain('Intro');
    expect(replaced).toContain('- AC-1 Tout neuf');
    expect(replaced).not.toContain('Vieux critère');
    expect(replaced).toContain('## Déploiement');
  });
});

describe('JiraGateway - champ de couverture et propriétés', () => {
  it('écrit proof-coverage-label et proof-gate-passed en propriétés de ticket indexées', async () => {
    const { requestJira, log } = mockTransport({
      '/rest/api/3/issue/10001/properties/': { ok: true, status: 200, json: async () => ({}) },
    });
    const jira = createJiraGateway({ requestJira });
    const ok = await jira.setCoverageField('10001', '3 / 4', 3, 4);
    expect(ok).toBe(true);

    const urls = log.map((l) => l.url);
    expect(urls.some((u) => u.includes(COVERAGE_LABEL_PROPERTY))).toBe(true);
    expect(urls.some((u) => u.includes(COVERAGE_GATE_PROPERTY))).toBe(true);
  });
});

describe('JiraGateway - rôles, notifications et profil', () => {
  it('parcourt les rôles du projet et retourne ceux auxquels le compte appartient', async () => {
    const { requestJira } = mockTransport({
      '/rest/api/3/project/PAY/role': {
        Developers: 'https://jira.test/rest/api/3/project/PAY/role/1001',
        Administrators: 'https://jira.test/rest/api/3/project/PAY/role/1002',
      },
      '/rest/api/3/project/PAY/role/1001': {
        name: 'Developers',
        actors: [{ actorUser: { accountId: 'user-dev' } }],
      },
      '/rest/api/3/project/PAY/role/1002': {
        name: 'Administrators',
        actors: [{ actorUser: { accountId: 'user-admin' } }],
      },
    });

    const jira = createJiraGateway({ requestJira });
    const roles = await jira.projectRoles('PAY', 'user-dev');
    expect(roles).toEqual(['Developers']);
  });

  it('envoie une notification directe et retombe sur un commentaire en cas d échec', async () => {
    const { requestJira, log } = mockTransport({
      '/rest/api/3/issue/PAY-123/notify': { ok: false, status: 403, json: async () => ({}) },
      '/rest/api/3/issue/PAY-123/comment': { ok: true, status: 201, json: async () => ({}) },
    });
    const jira = createJiraGateway({ requestJira });
    const ok = await jira.notify('user-1', 'Attestation requise', 'Merci de valider AC-1', 'PAY-123');
    expect(ok).toBe(true);
    expect(log.some((l) => l.url.includes('/comment'))).toBe(true);
  });

  it('lit le nom affiché ou renvoie accountId en repli', async () => {
    const { requestJira } = mockTransport({
      '/rest/api/3/user?accountId=user-1': { displayName: 'Alice Dupont' },
    });
    const jira = createJiraGateway({ requestJira });
    expect(await jira.displayName('user-1')).toBe('Alice Dupont');
    expect(await jira.displayName('user-unknown')).toBe('user-unknown');
  });

  it('gère un timeout sans lever d exception brute', async () => {
    const jira = createJiraGateway({
      timeoutMs: 10,
      requestJira: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 100)),
    });
    const issue = await jira.getIssue('PAY-123');
    expect(issue).toBeNull();
  });
});

describe('JiraGateway - robustesse : réponse vide, erreur réseau, délai dépassé', () => {
  const brokenTransport = async (): Promise<HttpResponse> => {
    throw new Error('socket hang up');
  };
  const hangingTransport = (): Promise<HttpResponse> =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 200),
    );

  it('findIssueByBranch renvoie null sur une branche sans clé et sur erreur réseau', async () => {
    const { requestJira } = mockTransport({});
    const jira = createJiraGateway({ requestJira });
    expect(await jira.findIssueByBranch('PAY', 'main')).toBeNull();

    const broken = createJiraGateway({ requestJira: brokenTransport });
    expect(await broken.findIssueByBranch('PAY', 'feat/PAY-123')).toBeNull();
  });

  it('listIssuesOfVersion renvoie une liste vide sur erreur réseau', async () => {
    const jira = createJiraGateway({ requestJira: brokenTransport });
    expect(await jira.listIssuesOfVersion('PAY', '10001')).toEqual([]);
  });

  it('rewriteDescriptionSection renvoie false si la lecture du ticket échoue', async () => {
    const jira = createJiraGateway({ requestJira: brokenTransport });
    expect(await jira.rewriteDescriptionSection('PAY-123', '- AC-1')).toBe(false);
    expect(await jira.rewriteDescriptionSection('', '- AC-1')).toBe(false);
  });

  it('rewriteDescriptionSection renvoie false si Jira refuse l écriture', async () => {
    const { requestJira } = mockTransport({
      '/rest/api/3/issue/PAY-123?fields=description': {
        id: '1',
        key: 'PAY-123',
        fields: { description: '## Critères d\'acceptation\n- vieux' },
      },
      '/rest/api/3/issue/PAY-123': { ok: false, status: 403, json: async () => ({}) },
    });
    const jira = createJiraGateway({ requestJira });
    expect(await jira.rewriteDescriptionSection('PAY-123', '- AC-1 neuf')).toBe(false);
  });

  it('setCoverageField renvoie false quand les propriétés ne peuvent pas être écrites', async () => {
    const jira = createJiraGateway({ requestJira: brokenTransport });
    expect(await jira.setCoverageField('10001', '3 / 4', 3, 4)).toBe(false);
    expect(await jira.setCoverageField('', '0 / 0', 0, 0)).toBe(false);
  });

  it('setCoverageField tente aussi le champ personnalisé déclaré et se contente de sa réussite', async () => {
    const { requestJira, log } = mockTransport({
      '/rest/api/3/issue/10001/properties/': { ok: false, status: 403, json: async () => ({}) },
      '/rest/api/3/issue/10001': { ok: true, status: 204, json: async () => ({}) },
    });
    const jira = createJiraGateway({ requestJira, coverageFieldId: 'customfield_10050' });
    const ok = await jira.setCoverageField('10001', '', 2, 5);
    expect(ok).toBe(true);
    const put = log.find((entry) => entry.method === 'PUT' && entry.url.endsWith('/issue/10001'));
    expect(put?.body).toEqual({ fields: { customfield_10050: '2 / 5' } });
  });

  it('projectRoles renvoie des rôles vides sur erreur réseau ou carte illisible', async () => {
    const jira = createJiraGateway({ requestJira: brokenTransport });
    expect(await jira.projectRoles('PAY', 'user-1')).toEqual([]);
    expect(await jira.projectRoles('', 'user-1')).toEqual([]);
    expect(await jira.projectRoles('PAY', '')).toEqual([]);
  });

  it('notify renvoie false quand la notification et le commentaire de repli échouent', async () => {
    const jira = createJiraGateway({ requestJira: brokenTransport });
    expect(await jira.notify('user-1', 'sujet', 'corps', 'PAY-123')).toBe(false);
    expect(await jira.notify('user-1', 'sujet', 'corps', '')).toBe(false);
  });

  it('displayName renvoie une chaîne vide pour un compte vide', async () => {
    const jira = createJiraGateway({ requestJira: brokenTransport });
    expect(await jira.displayName('')).toBe('');
  });

  it('borne l attente de chaque appel : un transport qui pend ne bloque jamais', async () => {
    const jira = createJiraGateway({ timeoutMs: 5, requestJira: hangingTransport });
    expect(await jira.getIssue('PAY-123')).toBeNull();
    expect(await jira.listIssuesOfVersion('PAY', '10001')).toEqual([]);
    expect(await jira.projectRoles('PAY', 'user-1')).toEqual([]);
    expect(await jira.displayName('user-1')).toBe('user-1');
    expect(await jira.notify('user-1', 's', 'b', 'PAY-123')).toBe(false);
  });
});
