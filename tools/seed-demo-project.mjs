/**
 * Fabrique l'environnement de démonstration du site de démonstration Jira.
 *
 * Un seul ticket avec quatre critères, c'est une maquette. Une équipe qui
 * livre, ça ressemble à ça :
 *
 *   PRF-1  le paiement par carte expirée est refusé   → en cours, 2 / 4
 *   PRF-2  l'e-mail de refus part au client            → livré, attesté, surveillé
 *   PRF-3  la limite de refus est réglable             → livré, une dérogation
 *
 * Le script crée les deux tickets manquants (idempotent), les amorce avec
 * l'app (critères, preuves, paires test ↔ critère confirmées, attestation ou
 * dérogation), joue un pipeline vert, les clôture, puis un passage sur la
 * branche principale où un test a disparu — le critère livré n'est plus
 * prouvé, et l'app le signale sur le ticket.
 *
 * Usage :
 *   ATLASSIAN_SITE=one-atlas-cndz.atlassian.net \
 *   ATLASSIAN_EMAIL=baptiste.faisy@gmail.com \
 *   ATLASSIAN_API_TOKEN=… \
 *   DEMO_BOOTSTRAP_URL=… DEMO_CI_URL=… DEMO_CI_KEY=… \
 *   node tools/seed-demo-project.mjs
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { createHmac } from 'node:crypto';

const SITE = process.env.ATLASSIAN_SITE ?? 'one-atlas-cndz.atlassian.net';
const EMAIL = process.env.ATLASSIAN_EMAIL ?? 'baptiste.faisy@gmail.com';
const TOKEN = process.env.ATLASSIAN_API_TOKEN ?? '';
const BOOTSTRAP = process.env.DEMO_BOOTSTRAP_URL ?? '';
const CI_URL = process.env.DEMO_CI_URL ?? '';
const CI_KEY = process.env.DEMO_CI_KEY ?? '';
const PROJECT = process.env.DEMO_PROJECT ?? 'PRF';
const VERSION = process.env.DEMO_VERSION ?? '2.4';
const BRANCH = `feature/PRF-1-refusal-email`;
const MAIN_BRANCH = 'main';

const AUTH = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')}`;

/** Les personnes du projet : l'agent, l'assignée, la testeuse, le product owner. */
const PEOPLE = {
  // Seuls les comptes réels du répertoire sont assignables ; les utilisateurs
  // d'exemple (« qm:…») servent d'acteurs, pas d'assignés.
  assignee: process.env.DEMO_ASSIGNEE ?? '712020:ba9bbe36-cf26-4e6a-8f5e-2369b742296b',
  tester: process.env.DEMO_TESTER ?? 'qm:3c40c266-5bfe-472a-81b5-402741ae10bc:f8ffb3d8-81c2-4aad-8ad3-bf3ce4b977d0',
  owner: process.env.DEMO_OWNER ?? 'qm:3c40c266-5bfe-472a-81b5-402741ae10bc:856b0972-1fe4-4576-ab3d-299308631fa0',
  agent: process.env.DEMO_AGENT ?? '712020:7c0e2290-25a0-413d-888b-3b6550b7d598',
};

const TICKETS = [
  {
    key: 'PRF-2',
    summary: "Envoyer l'e-mail de refus au client",
    tests: ['refusal email is sent once', 'refusal email quotes the reason'],
  },
  {
    key: 'PRF-3',
    summary: 'Rendre la limite de refus réglable par un administrateur',
    tests: ['refund limit is configurable', 'refund limit applies to next checkout'],
  },
];

/** Appel REST Jira : renvoie le corps JSON ou null. */
async function jira(method, path, body) {
  const response = await fetch(`https://${SITE}${path}`, {
    method,
    headers: { authorization: AUTH, accept: 'application/json', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Jira ${method} ${path} → HTTP ${response.status} : ${text.slice(0, 200)}`);
  return text === '' ? null : JSON.parse(text);
}

/** L'identifiant et le type de ticket du projet. */
async function issueTypes() {
  const meta = await jira('GET', `/rest/api/3/issue/createmeta/${PROJECT}/issuetypes`);
  const types = meta.issueTypes ?? meta.values ?? [];
  const task = types.find((type) => type.name === 'Tâche') ?? types[0];
  return task ?? { id: '10002' };
}

/** Crée le ticket s'il n'existe pas encore ; renvoie sa clé. */
async function ensureTicket(ticket, typeId) {
  // L'API `/search` a été retirée : seule `/search/jql` répond (POST + JQL).
  const search = await jira('POST', '/rest/api/3/search/jql', {
    jql: `project = ${PROJECT} AND summary ~ "${ticket.summary}"`,
    maxResults: 1,
    fields: ['summary'],
  });
  if ((search.issues ?? []).length > 0) return search.issues[0].key;
  const issue = await jira('POST', '/rest/api/3/issue', {
    fields: {
      project: { key: PROJECT },
      summary: ticket.summary,
      issuetype: { id: typeId },
      assignee: { id: PEOPLE.assignee },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: "Ticket de démonstration : les critères sont écrits par l’app.",
              },
            ],
          },
        ],
      },
    },
  });
  return issue.key;
}

/** Fait passer le ticket à « Terminé ». */
async function closeTicket(key) {
  const transitions = await jira('GET', `/rest/api/3/issue/${key}/transitions`);
  const wanted =
    transitions.transitions?.find((transition) => /termin|done/i.test(transition.name)) ??
    transitions.transitions?.[0];
  if (wanted === undefined) return false;
  await jira('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: wanted.id } });
  return true;
}

/** Joue un pipeline : résumé signé, poussé au web trigger de l'app. */
async function pipeline({ branch, tests, mainBranch, commit }) {
  const summary = {
    repo: 'BaptisteFaisy/preuve-a-l-appui',
    branch,
    commit,
    mainBranch,
    tests: tests.map((name) => ({ name, state: 'passed', durationMs: 40 })),
    receivedAt: new Date().toISOString(),
  };
  const body = JSON.stringify(summary);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', CI_KEY).update(`${timestamp}.${body}`).digest('hex');
  const response = await fetch(CI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ci-key': CI_KEY,
      'x-ci-timestamp': timestamp,
      'x-ci-signature': signature,
    },
    body,
  });
  return response.status;
}

/** Amorce un ticket : critères, preuves, paires confirmées, gestes humains. */
async function bootstrap(key, flow) {
  const response = await fetch(BOOTSTRAP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bootstrap-token': process.env.DEMO_BOOTSTRAP_TOKEN ?? '',
    },
    body: JSON.stringify({
      action: 'bootstrap',
      issueKey: key,
      ciKey: CI_KEY,
      cast: { developer: PEOPLE.assignee, tester: PEOPLE.tester, owner: PEOPLE.owner, agent: PEOPLE.agent },
      flow,
    }),
  });
  return `${response.status} ${(await response.text()).slice(0, 120)}`;
}

if (TOKEN === '' || BOOTSTRAP === '' || CI_URL === '' || CI_KEY === '') {
  console.error(
    'variables manquantes : ATLASSIAN_API_TOKEN, DEMO_BOOTSTRAP_URL, DEMO_CI_URL, DEMO_CI_KEY',
  );
  process.exit(1);
}

const type = await issueTypes();
for (const ticket of TICKETS) {
  const key = await ensureTicket(ticket, type.id);
  const flow =
    ticket.key === 'PRF-2'
      ? { attest: [{ code: 'AC-3', accountId: PEOPLE.tester }] }
      : { waive: [{ code: 'AC-2', accountId: PEOPLE.owner, role: 'Product Owner', reason: 'Reporté à la version 2.5, le réglage arrive avec la refonte du back-office.' }] };
  console.log(`${key} amorçage → ${await bootstrap(key, flow)}`);
  console.log(`${key} pipeline → ${await pipeline({ branch: `feature/${key}-wip`, tests: ticket.tests, mainBranch: false, commit: 'a1b2c3d4e5f6a7b8' })}`);
  console.log(`${key} clôture → ${await closeTicket(key)}`);
}

// Un passage sur la branche principale où un test a disparu : le critère livré
// de PRF-2 n'est plus prouvé, et l'app le signale.
console.log(
  `main (avec un test disparu) → ${await pipeline({
    branch: MAIN_BRANCH,
    tests: ['refusal email is sent once'],
    mainBranch: true,
    commit: 'f6e5d4c3b2a1',
  })}`,
);
console.log('environnement de démonstration complet');
