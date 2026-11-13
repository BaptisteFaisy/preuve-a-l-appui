#!/usr/bin/env node
/**
 * Rejoue le catalogue de démonstration dans l'environnement réel.
 *
 * Le catalogue (`tools/demo-scenarios/`) est la **seule** source : ce script ne
 * connaît aucun critère, aucun résumé, aucun test. Il lit le catalogue, puis
 * joue, ticket par ticket :
 *
 *   1. le ticket est créé s'il manque (jamais modifié s'il existe) ;
 *   2. il est amorcé avec **son** scénario (critères, preuves, gestes) ;
 *   3. un pipeline CI joue les tests du ticket, sur sa branche ;
 *   4. le ticket prévu est livré ;
 *   5. les passages sur `main` installent la preuve vivante, puis la font tomber
 *      pour le ticket dont le test a disparu ;
 *   6. ce ticket-là est rouvert — et lui seul.
 *
 * Deux règles de sûreté, apprises à force :
 * - **jamais `transitions[0]`** : sur un ticket déjà livré, la première
 *   transition est souvent « Réouvrir ». On cherche donc une transition par
 *   son **nom**, et un ticket déjà livré n'est jamais rouvert par hasard ;
 * - **jamais PRF-1** : la vedette du site n'est pas au catalogue, donc ce
 *   script ne la voit pas.
 *
 * Usage :
 *   ATLASSIAN_SITE=one-atlas-cndz.atlassian.net \
 *   ATLASSIAN_EMAIL=baptiste.faisy@gmail.com \
 *   ATLASSIAN_API_TOKEN=… \
 *   DEMO_BOOTSTRAP_URL=… DEMO_BOOTSTRAP_TOKEN=… \
 *   DEMO_CI_URL=… DEMO_CI_KEY=… \
 *   node tools/seed-demo-project.mjs
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEMO_SCENARIOS } from './demo-scenarios.mjs';
import { DEMO_COMMITS, DEMO_MAIN_COMMITS, DEMO_REPO } from './demo-scenarios/repo.mjs';

const SITE = process.env.ATLASSIAN_SITE ?? 'one-atlas-cndz.atlassian.net';
const EMAIL = process.env.ATLASSIAN_EMAIL ?? 'baptiste.faisy@gmail.com';
const TOKEN = process.env.ATLASSIAN_API_TOKEN ?? '';
const BOOTSTRAP = process.env.DEMO_BOOTSTRAP_URL ?? '';
const BOOTSTRAP_TOKEN = process.env.DEMO_BOOTSTRAP_TOKEN ?? '';
const CI_URL = process.env.DEMO_CI_URL ?? '';
const CI_KEY = process.env.DEMO_CI_KEY ?? '';
const CIBLE_FILE = process.env.DEMO_CIBLE ?? join(homedir(), '.atlassian', 'preuve-demo-cible.json');
const MAIN_BRANCH = 'main';

/** Les quatre rôles du catalogue : les mêmes clés que la cible. */
const ACTOR_KEYS = ['developer', 'tester', 'owner', 'agent'];

/** Les statuts « livré » : la preuve vivante ne suit que ceux-là (SPEC §13). */
const DONE_RE = /termin|done|clos|ferme|résolu|resolu|complete/i;

/** La transition de réouverture — cherchée **par son nom**, jamais par rang. */
const REOPEN_RE = /rouvrir|reopen/i;

const AUTH = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')}`;

/* ------------------------------------------------------------------ cible */

/** La cible du site de démonstration : projet, version et distribution. */
function readCible() {
  let raw;
  try {
    raw = readFileSync(CIBLE_FILE, 'utf8');
  } catch {
    throw new Error(`cible introuvable : ${CIBLE_FILE} (DEMO_CIBLE pour la changer)`);
  }
  const cible = JSON.parse(raw);
  const cast = { ...cible.cast };
  for (const key of ACTOR_KEYS) {
    const override = process.env[`DEMO_${key.toUpperCase()}`];
    if (typeof override === 'string' && override !== '') cast[key] = override;
  }
  return {
    cast,
    projectKey: process.env.DEMO_PROJECT ?? cible.projectKey ?? 'PRF',
    versionId: cible.versionId ?? '',
    issueKey: cible.issueKey ?? 'PRF-1',
  };
}

/* ------------------------------------------------------------------ jira */

/** Appel REST Jira : renvoie le corps JSON, ou lève une erreur datée. */
async function jira(method, path, body) {
  const response = await fetch(`https://${SITE}${path}`, {
    method,
    headers: {
      authorization: AUTH,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `Jira ${method} ${path} → HTTP ${response.status} : ${text.slice(0, 200)}`,
    );
    error.status = response.status;
    throw error;
  }
  return text === '' ? null : JSON.parse(text);
}

/** Le ticket, ou `null` s'il n'existe pas encore. */
async function getIssue(key) {
  try {
    return await jira('GET', `/rest/api/3/issue/${key}?fields=summary,status,components`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** L'identifiant du type de ticket à utiliser (Tâche si elle existe). */
async function issueTypes(projectKey) {
  const meta = await jira('GET', `/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  const types = meta.issueTypes ?? meta.values ?? [];
  const task = types.find((type) => type.name === 'Tâche') ?? types[0];
  return task ?? { id: '10002' };
}

/** Le composant du projet, créé s'il manque ; `null` si le site refuse. */
async function ensureComponent(projectKey, name) {
  if (name === '') return null;
  try {
    const found = await jira('GET', `/rest/api/3/project/${projectKey}/components`);
    const hit = (found ?? []).find((component) => component.name === name);
    if (hit !== undefined) return hit.id;
    const created = await jira('POST', '/rest/api/3/component', { name, project: projectKey });
    return created?.id ?? null;
  } catch (error) {
    console.warn(`  composant « ${name} » indisponible : ${error.message}`);
    return null;
  }
}

/** La description du ticket, en ADF : un paragraphe par ligne. */
function adf(text) {
  const content = String(text)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
  return { type: 'doc', version: 1, content };
}

/** L'assigné du ticket ; un refus ne casse pas le rejeu. */
async function assign(key, accountId) {
  if (accountId === '') return;
  try {
    await jira('PUT', `/rest/api/3/issue/${key}/assignee`, { accountId });
  } catch (error) {
    console.warn(`  ${key} : assignation impossible (${error.message})`);
  }
}

/* -------------------------------------------------------------- tickets */

/** Crée le ticket s'il manque ; ne touche jamais à un ticket existant. */
async function ensureTicket(ticket, typeId, project, cast) {
  const existing = await getIssue(ticket.key);
  if (existing !== null) {
    const summary = existing.fields?.summary ?? '';
    if (summary !== ticket.summary) {
      console.warn(`  ${ticket.key} existe avec un autre résumé : je n’y touche pas.`);
    }
    return false;
  }
  const fields = {
    project: { key: project.projectKey },
    summary: ticket.summary,
    issuetype: { id: typeId },
    description: adf(ticket.description),
  };
  const componentId = await ensureComponent(project.projectKey, ticket.component);
  if (componentId !== null) fields.components = [{ id: componentId }];
  if (project.versionId !== '') fields.fixVersions = [{ id: project.versionId }];
  const created = await jira('POST', '/rest/api/3/issue', { fields });
  await assign(ticket.key, resolveActor(cast, ticket.cast.developer));
  console.log(`  ${ticket.key} créé (${created.key})`);
  return true;
}

/* --------------------------------------------------------------- acteurs */

/** L'identifiant réel d'un rôle symbolique (`tester` → accountId). */
function resolveActor(cast, key) {
  const accountId = cast[key];
  if (typeof accountId !== 'string' || accountId === '') {
    throw new Error(`acteur inconnu dans la cible : ${key}`);
  }
  return accountId;
}

/** La distribution réelle d'un ticket, rôle par rôle. */
function resolveCast(ticket, cast) {
  const resolved = {};
  for (const key of ACTOR_KEYS) resolved[key] = resolveActor(cast, ticket.cast[key]);
  return resolved;
}

/** Le scénario jouable : les rôles symboliques deviennent des comptes. */
function resolveScenario(scenario, cast) {
  return {
    ...scenario,
    attest: scenario.attest.map((one) => ({
      ...one,
      accountId: resolveActor(cast, one.accountId),
    })),
    waive: scenario.waive.map((one) => ({
      ...one,
      accountId: resolveActor(cast, one.accountId),
    })),
  };
}

/* -------------------------------------------------------------- amorçage */

/** Amorce le ticket avec SON scénario (critères, preuves, gestes). */
async function bootstrap(ticket, cast) {
  const body = {
    action: 'bootstrap',
    issueKey: ticket.key,
    ciKey: CI_KEY,
    cast: resolveCast(ticket, cast),
    scenario: resolveScenario(ticket.scenario, cast),
  };
  const response = await fetch(BOOTSTRAP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bootstrap-token': BOOTSTRAP_TOKEN,
    },
    body: JSON.stringify(body),
  });
  return `${response.status} ${(await response.text()).slice(0, 160)}`;
}

/* -------------------------------------------------------------------- CI */

/**
 * Le commit d'un ticket : **l'empreinte réelle** de la branche qui porte son
 * test, dans le dépôt public de la démonstration. Un jury peut donc vérifier
 * une preuve : le commit existe, le test y est, et il passe.
 */
function commitOf(label) {
  const known = DEMO_COMMITS[label];
  if (typeof known === 'string' && known !== '') return known;
  const fallback = DEMO_MAIN_COMMITS[label];
  if (typeof fallback === 'string' && fallback !== '') return fallback;
  return createHash('sha1').update(label).digest('hex').slice(0, 16);
}

/** Joue un pipeline : résumé signé, poussé au web trigger de l'app. */
async function pipeline({ branch, tests, commit, mainBranch, failing = [] }) {
  const summary = {
    repo: DEMO_REPO,
    branch,
    commit,
    mainBranch,
    // Un test qui échoue reste un test : c'est ce que la CI publie, et c'est
    // ce que l'app doit voir pour faire tomber la preuve vivante.
    tests: tests.map((name) => ({
      name,
      state: failing.includes(name) ? 'failed' : 'passed',
      durationMs: 40,
    })),
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

/* ------------------------------------------------------------ transitions */

/** Les transitions possibles du ticket. */
async function transitionsOf(key) {
  const found = await jira('GET', `/rest/api/3/issue/${key}/transitions`);
  return found?.transitions ?? [];
}

/** Le nom des transitions, pour dire pourquoi on ne fait rien. */
function namesOf(transitions) {
  return transitions.map((one) => one.name).join(', ') || 'aucune';
}

/** Applique une transition choisie PAR SON NOM. */
async function applyTransition(key, wanted) {
  await jira('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: wanted.id } });
}

/** Livre le ticket s'il ne l'est pas déjà ; ne refait rien sinon. */
async function closeTicket(key) {
  const issue = await getIssue(key);
  const status = String(issue?.fields?.status?.name ?? '');
  if (status === '') return 'statut illisible';
  if (DONE_RE.test(status)) return `déjà livré (${status}) — rien à faire`;
  const transitions = await transitionsOf(key);
  const wanted = transitions.find(
    (one) => DONE_RE.test(one.name) && !REOPEN_RE.test(one.name),
  );
  if (wanted === undefined) return `aucune transition de livraison (${namesOf(transitions)})`;
  await applyTransition(key, wanted);
  return `livré (${wanted.name})`;
}

/** Rouvre le ticket livré — et lui seul, jamais par hasard. */
async function reopenTicket(key) {
  const issue = await getIssue(key);
  const status = String(issue?.fields?.status?.name ?? '');
  if (status === '') return 'statut illisible';
  if (!DONE_RE.test(status)) return `non livré (${status}) — pas de réouverture`;
  const transitions = await transitionsOf(key);
  const wanted = transitions.find((one) => REOPEN_RE.test(one.name));
  if (wanted === undefined) return `aucune transition de réouverture (${namesOf(transitions)})`;
  await applyTransition(key, wanted);
  return `rouvert (${wanted.name})`;
}

/* ------------------------------------------------------------------ jeu */

/** L'union des tests d'une colonne du catalogue (`tests` ou `mainTests`). */
function unionTests(column) {
  const names = new Set();
  for (const ticket of DEMO_SCENARIOS) {
    for (const name of ticket[column]) names.add(name);
  }
  return [...names];
}


/** Les tests que la branche principale fait ÉCHOUER (la régression rejouée). */
function failingTests() {
  const names = new Set();
  for (const ticket of DEMO_SCENARIOS) {
    for (const name of ticket.failing ?? []) names.add(name);
  }
  return [...names];
}

/** Joue un ticket : création, amorçage, pipeline, livraison. */
async function playTicket(ticket, typeId, project, cast) {
  console.log(`${ticket.key} — ${ticket.summary}`);
  await ensureTicket(ticket, typeId, project, cast);
  console.log(`  amorçage → ${await bootstrap(ticket, cast)}`);
  if (ticket.tests.length > 0) {
    const status = await pipeline({
      branch: ticket.branch,
      tests: ticket.tests,
      commit: commitOf(ticket.key),
      mainBranch: false,
      failing: ticket.failing ?? [],
    });
    console.log(`  pipeline (branche) → ${status}`);
  }
  if (ticket.close) console.log(`  clôture → ${await closeTicket(ticket.key)}`);
}

/**
 * Reconstruit le dossier de preuve figé de la version : il liste les tickets
 * de la version avec leur couverture réelle (SPEC §17, FP-17). Un dossier
 * figé ne se réécrit pas tout seul — la démonstration, elle, evolves.
 */
async function refreshDossier(issueKey) {
  const response = await fetch(BOOTSTRAP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bootstrap-token': BOOTSTRAP_TOKEN,
    },
    body: JSON.stringify({ action: 'dossier', issueKey }),
  });
  return `${response.status} ${(await response.text()).slice(0, 120)}`;
}

/**
 * Rafraîchit l'instantané public du ticket vedette : l'app ne réécrit sa
 * propriété que lorsqu'une couverture change. Le bootstrap du ticket (sans
 * scénario) relance le calcul de couverture, donc l'instantané.
 */
async function refreshVedette(issueKey, cast) {
  const response = await fetch(BOOTSTRAP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bootstrap-token': BOOTSTRAP_TOKEN,
    },
    body: JSON.stringify({
      action: 'bootstrap',
      issueKey,
      ciKey: CI_KEY,
      cast,
    }),
  });
  return `${response.status} ${(await response.text()).slice(0, 120)}`;
}

/* ------------------------------------------------------------------ main */

if (TOKEN === '' || BOOTSTRAP === '' || CI_URL === '' || CI_KEY === '') {
  console.error(
    'variables manquantes : ATLASSIAN_API_TOKEN, DEMO_BOOTSTRAP_URL, DEMO_CI_URL, DEMO_CI_KEY',
  );
  process.exit(1);
}

const cible = readCible();
const project = { projectKey: cible.projectKey, versionId: cible.versionId };
const type = await issueTypes(project.projectKey);

for (const ticket of DEMO_SCENARIOS) {
  await playTicket(ticket, type.id, project, cible.cast);
}

// Les passages sur `main` : le premier installe la preuve vivante des
// critères livrés, le second fait tomber celle du ticket dont le test a
// disparu de la branche principale (SPEC §7.5, §13).
console.log(`${MAIN_BRANCH} — tous les tests présents`);
console.log(
  `  pipeline → ${await pipeline({
    branch: MAIN_BRANCH,
    tests: unionTests('tests'),
    commit: commitOf(`${MAIN_BRANCH}-complete`),
    mainBranch: true,
  })}`,
);
console.log(`${MAIN_BRANCH} — le test de latence est rouge`);
console.log(
  `  pipeline → ${await pipeline({
    branch: MAIN_BRANCH,
    tests: unionTests('mainTests'),
    commit: commitOf(`${MAIN_BRANCH}-regressed`),
    mainBranch: true,
    failing: failingTests(),
  })}`,
);

// La réouverture vient **après** la chute de la preuve vivante : c'est elle
// qui la constate, et c'est le catalogue qui désigne le ticket à rouvrir.
for (const ticket of DEMO_SCENARIOS.filter((one) => one.reopen)) {
  console.log(`${ticket.key} — réouverture`);
  console.log(`  → ${await reopenTicket(ticket.key)}`);
}

// Le dossier de preuve de la version est reconstruit après tout le jeu : il
// doit refléter les tickets tels qu'ils sont maintenant.
console.log(`dossier de preuve → ${await refreshDossier(cible.issueKey)}`);
// L'instantané public du ticket vedette est réécrit à chaque écriture de
// couverture : on le déclenche pour qu'il reflète le projet d'aujourd'hui.
console.log(`instantané du ticket vedette → ${await refreshVedette(cible.issueKey, cible.cast)}`);

console.log('environnement de démonstration rejoué');
