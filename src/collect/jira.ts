/**
 * Adaptateur Jira : lecture des tickets (champs strictement nécessaires),
 * recherche par la clé dans le nom de branche, tickets d'une version,
 * réécriture de la **seule** section critères, champ de couverture (propriété
 * de ticket indexée en repli, SPEC §19), rôles projet, notification, nom
 * affiché (SPEC §8.2, §10, §12.3).
 *
 * Chaque appel externe est borné dans le temps et toute erreur devient une
 * valeur métier (`null`, `[]`, `false`) — jamais une exception brute, pour que
 * le validateur réponde vite et sans planter (SPEC §17, §20).
 *
 * Seul `src/collect/` importe `@forge/api` (docs/CONTRACTS.md §4bis) ; le
 * transport est injectable, donc les tests ne touchent jamais le réseau.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { route } from '@forge/api';
import type { Route } from '@forge/api';
import type { JiraGateway } from '../ports';
import type { IssueRef } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  defaultJiraRequest,
  jsonInit,
  readJsonOrNull,
  withTimeout,
  type HttpResponse,
  type ProductRequest,
} from './http';
import {
  adfToPlainText,
  replaceCriteriaInAdf,
  replaceCriteriaInText,
  textToAdf,
} from './jira-adf';

/** Champs Jira strictement nécessaires pour construire `IssueRef` (SPEC §8.2). */
export const ISSUE_FIELDS = [
  'summary',
  'description',
  'status',
  'project',
  'assignee',
  'reporter',
  'components',
  'fixVersions',
  'subtasks',
] as const;

/** Propriétés de ticket indexées : le `jira:customField` les lit (SPEC §19). */
export const COVERAGE_LABEL_PROPERTY = 'proof-coverage-label';
export const COVERAGE_GATE_PROPERTY = 'proof-gate-passed';

/** Collection bornée : tickets d'une version (SPEC §20, légèreté). */
export const MAX_VERSION_ISSUES = 100;

/** Borne du parcours des rôles projet : jamais de boucle ouverte. */
export const MAX_ROLE_LOOKUPS = 20;

/** Clé Jira portée par un nom de branche, ex. `feat/PAY-123-fix` (SPEC §10). */
const BRANCH_ISSUE_KEY = /\b([A-Z][A-Z0-9]+-\d+)\b/;

export interface JiraGatewayOptions {
  /** Transport injecté (défaut : `api.asApp().requestJira`). */
  requestJira?: ProductRequest;
  /** Délai maximal d'une requête, en ms (défaut : `DEFAULT_TIMEOUT_MS`). */
  timeoutMs?: number;
  /** Champ personnalisé de couverture, s'il existe sur le site (repli §19). */
  coverageFieldId?: string;
}

/* ---------------------------------------------------------------- payloads */

interface RawIssueFields {
  summary?: string;
  description?: unknown;
  status?: { name?: string };
  project?: { id?: string; key?: string };
  assignee?: { accountId?: string } | null;
  reporter?: { accountId?: string } | null;
  components?: { name?: string }[];
  fixVersions?: { name?: string }[];
  subtasks?: { id?: string; key?: string }[];
}

interface RawIssue {
  id?: string;
  key?: string;
  fields?: RawIssueFields;
}

interface RawSearchPage {
  issues?: RawIssue[];
}

interface RawProjectRole {
  name?: string;
  actors?: { actorUser?: { accountId?: string } }[];
}

interface RawUser {
  displayName?: string;
}

/* ----------------------------------------------------------------- helpers */

/** Première clé Jira d'un nom de branche ; `null` si la branche n'en porte pas. */
export function extractIssueKeyFromBranch(branch: string): string | null {
  const match = BRANCH_ISSUE_KEY.exec(branch.toUpperCase());
  return match ? match[1]! : null;
}

function namesOf(entries: readonly { name?: string }[] | undefined): string[] {
  return (entries ?? []).map((entry) => entry.name ?? '').filter((name) => name.length > 0);
}

/** Payload Jira → `IssueRef` : la description ADF devient du texte brut. */
export function toIssueRef(raw: RawIssue): IssueRef {
  const fields = raw.fields ?? {};
  return {
    id: raw.id ?? '',
    key: raw.key ?? '',
    projectId: fields.project?.id ?? '',
    projectKey: fields.project?.key ?? '',
    summary: fields.summary ?? '',
    description: adfToPlainText(fields.description),
    status: fields.status?.name ?? '',
    assigneeAccountId: fields.assignee?.accountId ?? '',
    reporterAccountId: fields.reporter?.accountId ?? '',
    components: namesOf(fields.components),
    fixVersions: namesOf(fields.fixVersions),
    children: (fields.subtasks ?? [])
      .map((entry) => entry.key ?? entry.id ?? '')
      .filter((value) => value.length > 0),
  };
}

/** Valeur de JQL entre guillemets : guillemets et antislashs retirés. */
export function jqlValue(value: string): string {
  return `"${value.replace(/["\\]/g, '')}"`;
}

/** Identifiant de rôle porté par l'URL de la carte des rôles projet. */
export function roleIdFromUrl(url: string): string | null {
  const match = /\/role\/([^/?#]+)$/.exec(url);
  return match && match[1] ? match[1]! : null;
}

/* --------------------------------------------------------------- transport */

/** Transport borné : trois formes d'appel, aucune ne lève d'exception. */
export interface JiraTransport {
  getJson<T>(target: Route): Promise<T | null>;
  sendJson<T>(target: Route, body: unknown): Promise<T | null>;
  write(target: Route, method: 'PUT' | 'POST', body: unknown): Promise<boolean>;
}

function timed(request: ProductRequest, timeoutMs: number, target: Route, init: ReturnType<typeof jsonInit>) {
  return withTimeout<HttpResponse | null>(
    (signal) => request(target, { ...init, signal }).catch(() => null),
    timeoutMs,
  ).catch(() => null);
}

/** Fabrique le transport ; une erreur réseau ou un délai devient `null`. */
export function createJiraTransport(request: ProductRequest, timeoutMs: number): JiraTransport {
  return {
    async getJson<T>(target: Route): Promise<T | null> {
      const response = await timed(request, timeoutMs, target, jsonInit('GET'));
      return readJsonOrNull<T>(response);
    },
    async sendJson<T>(target: Route, body: unknown): Promise<T | null> {
      const response = await timed(request, timeoutMs, target, jsonInit('POST', body));
      return readJsonOrNull<T>(response);
    },
    async write(target: Route, method: 'PUT' | 'POST', body: unknown): Promise<boolean> {
      const response = await timed(request, timeoutMs, target, jsonInit(method, body));
      return response?.ok === true;
    },
  };
}

/** État partagé par les groupes de méthodes : transport + réglages. */
interface JiraState {
  transport: JiraTransport;
  fields: string;
  coverageFieldId: string;
}

async function readIssue(state: JiraState, issueIdOrKey: string, wanted: string): Promise<IssueRef | null> {
  if (!issueIdOrKey) return null;
  const raw = await state.transport.getJson<RawIssue>(
    route`/rest/api/3/issue/${issueIdOrKey}?fields=${wanted}`,
  );
  return raw?.id && raw.key ? toIssueRef(raw) : null;
}

/* ------------------------------------------------------------------ lectures */

/** Lectures du port : ticket, ticket d'une branche, tickets d'une version. */
function createJiraReads(state: JiraState) {
  return {
    async getIssue(issueIdOrKey: string): Promise<IssueRef | null> {
      return readIssue(state, issueIdOrKey, state.fields);
    },
    async findIssueByBranch(projectId: string, branch: string): Promise<IssueRef | null> {
      const key = extractIssueKeyFromBranch(branch);
      if (!key) return null;
      const issue = await readIssue(state, key, state.fields);
      if (!issue) return null;
      const inProject = !projectId || issue.projectId === projectId || issue.projectKey === projectId;
      return inProject ? issue : null;
    },
    async listIssuesOfVersion(projectId: string, versionId: string): Promise<IssueRef[]> {
      if (!projectId || !versionId) return [];
      const jql = `project = ${jqlValue(projectId)} AND fixVersion = ${jqlValue(versionId)}`;
      const page = await state.transport.sendJson<RawSearchPage>(route`/rest/api/3/search/jql`, {
        jql,
        fields: [...ISSUE_FIELDS],
        maxResults: MAX_VERSION_ISSUES,
      });
      return (page?.issues ?? []).filter((raw) => raw.id && raw.key).map(toIssueRef);
    },
  };
}

/* ------------------------------------------------------------------ écritures */

/** Description réécrite : ADF si Jira renvoie de l'ADF, texte brut sinon. */
function updatedDescription(current: unknown, section: string): unknown {
  return typeof current === 'string'
    ? replaceCriteriaInText(current, section)
    : replaceCriteriaInAdf(current, section);
}

/**
 * Couverture écrite en propriétés de ticket indexées : le `jira:customField`
 * du manifest les lit via `issue.properties[...]` (SPEC §12.3, repli §19).
 */
async function writeCoverageProperties(
  state: JiraState,
  issueId: string,
  label: string,
  proven: number,
  total: number,
): Promise<boolean> {
  const value = coverageValue(label, proven, total);
  const labelOk = await state.transport.write(
    route`/rest/api/3/issue/${issueId}/properties/${COVERAGE_LABEL_PROPERTY}`,
    'PUT',
    value,
  );
  const gateOk = await state.transport.write(
    route`/rest/api/3/issue/${issueId}/properties/${COVERAGE_GATE_PROPERTY}`,
    'PUT',
    total > 0 && proven >= total,
  );
  return labelOk && gateOk;
}

/** Libellé affiché dans le champ : celui fourni, sinon « n / m » (SPEC §16). */
export function coverageValue(label: string, proven: number, total: number): string {
  return label.trim().length > 0 ? label.trim() : `${proven} / ${total}`;
}

/** Réécriture de la description et du champ de couverture (SPEC §8.2, §12.3). */
function createJiraIssueWrites(state: JiraState) {
  return {
    async rewriteDescriptionSection(issueId: string, section: string): Promise<boolean> {
      if (!issueId) return false;
      const raw = await state.transport.getJson<RawIssue>(
        route`/rest/api/3/issue/${issueId}?fields=description`,
      );
      if (!raw) return false;
      return state.transport.write(route`/rest/api/3/issue/${issueId}`, 'PUT', {
        fields: { description: updatedDescription(raw.fields?.description, section) },
      });
    },
    async setCoverageField(
      issueId: string,
      label: string,
      proven: number,
      total: number,
    ): Promise<boolean> {
      if (!issueId) return false;
      const propertiesOk = await writeCoverageProperties(state, issueId, label, proven, total);
      if (!state.coverageFieldId) return propertiesOk;
      const fieldOk = await state.transport.write(route`/rest/api/3/issue/${issueId}`, 'PUT', {
        fields: { [state.coverageFieldId]: coverageValue(label, proven, total) },
      });
      return propertiesOk || fieldOk;
    },
  };
}

/** Rôles projet d'un compte : carte des rôles puis chaque rôle, borné. */
async function rolesOfAccount(state: JiraState, projectId: string, accountId: string): Promise<string[]> {
  const roleUrls = await state.transport.getJson<Record<string, string>>(
    route`/rest/api/3/project/${projectId}/role`,
  );
  if (!roleUrls) return [];
  const roles: string[] = [];
  for (const [key, url] of Object.entries(roleUrls).slice(0, MAX_ROLE_LOOKUPS)) {
    const roleId = roleIdFromUrl(url);
    if (!roleId) continue;
    const role = await state.transport.getJson<RawProjectRole>(
      route`/rest/api/3/project/${projectId}/role/${roleId}`,
    );
    const member = (role?.actors ?? []).some((actor) => actor.actorUser?.accountId === accountId);
    if (member) roles.push(role?.name?.trim() || key);
  }
  return roles;
}

/** Repli de notification : un commentaire qui mentionne le compte (SPEC §9.4). */
async function notifyByComment(
  state: JiraState,
  issueKey: string,
  accountId: string,
  subjectKey: string,
  bodyKey: string,
): Promise<boolean> {
  const mention = accountId ? `[~accountid:${accountId}] ` : '';
  return state.transport.write(route`/rest/api/3/issue/${issueKey}/comment`, 'POST', {
    body: textToAdf(`${mention}${subjectKey}: ${bodyKey}`),
  });
}

/** Rôles, notification et nom affiché : tout ce qui concerne les comptes. */
function createJiraPeopleWrites(state: JiraState) {
  return {
    async projectRoles(projectId: string, accountId: string): Promise<string[]> {
      if (!projectId || !accountId) return [];
      return rolesOfAccount(state, projectId, accountId);
    },
    async notify(
      accountId: string,
      subjectKey: string,
      bodyKey: string,
      issueKey: string,
    ): Promise<boolean> {
      if (!issueKey) return false;
      const sent = await state.transport.write(route`/rest/api/3/issue/${issueKey}/notify`, 'POST', {
        subject: subjectKey,
        textBody: bodyKey,
        to: { users: accountId ? [{ accountId }] : [] },
      });
      return sent || notifyByComment(state, issueKey, accountId, subjectKey, bodyKey);
    },
    async displayName(accountId: string): Promise<string> {
      if (!accountId) return '';
      const user = await state.transport.getJson<RawUser>(
        route`/rest/api/3/user?accountId=${accountId}`,
      );
      return user?.displayName?.trim() || accountId;
    },
  };
}

/* ------------------------------------------------------------------ fabrique */

/**
 * Construit l'adaptateur `JiraGateway`. Sans option, il parle au runtime Forge
 * en `asApp()` ; les tests injectent `requestJira` et n'ouvrent aucun socket.
 */
export function createJiraGateway(options: JiraGatewayOptions = {}): JiraGateway {
  const state: JiraState = {
    transport: createJiraTransport(
      options.requestJira ?? defaultJiraRequest(),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ),
    fields: ISSUE_FIELDS.join(','),
    coverageFieldId: options.coverageFieldId ?? '',
  };
  return {
    ...createJiraReads(state),
    ...createJiraIssueWrites(state),
    ...createJiraPeopleWrites(state),
  };
}
