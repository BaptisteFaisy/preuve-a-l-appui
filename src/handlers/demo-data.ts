/**
 * Point d'entrée du web trigger `demo-data` (lot `app-donnees-reelles`).
 *
 * Deux usages, une seule surface :
 *
 *   GET  ?issueKey=…[&site=…&repo=…&branch=…]
 *        → l'instantané RÉEL du ticket (Forge SQL + Jira), pseudonymisé, avec
 *          les en-têtes CORS : c'est ce que lit le site public pour rejouer le
 *          moteur sur des données vivantes au lieu du jeu embarqué.
 *          Lecture seule, aucun secret, aucun identifiant de compte ne sort.
 *
 *   POST { action: "bootstrap", issueKey, ciKey, cast }
 *        → amorce le scénario du SPEC §7 sur un ticket réel. Écriture protégée
 *          par le jeton de la variable d'app `FORGE_USER_VAR_DEMO_BOOTSTRAP_TOKEN`
 *          (comparaison en temps constant) ; si la variable est absente, le
 *          bootstrap est désactivé et répond 403.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import { buildDemoSnapshot } from '../demo-snapshot';
import { safeCompareHex } from '../ingest/signature';
import { bootstrapDemoData } from '../sample/bootstrap';
import type { BootstrapCast } from '../sample/bootstrap';
import type { CiWebRequest, CiWebResponse } from './ingest';

/** Variable d'app portant le jeton d'amorçage (jamais dans le dépôt). */
export const BOOTSTRAP_TOKEN_VAR = 'FORGE_USER_VAR_DEMO_BOOTSTRAP_TOKEN';

/** En-têtes CORS : le site public est sur un autre origine (GitHub Pages). */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-bootstrap-token',
  'access-control-max-age': '600',
  'cache-control': 'no-store',
};

/** Réponse JSON, en-têtes CORS compris. */
export function demoJson(statusCode: number, payload: unknown): CiWebResponse {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

/** Lecture d'en-tête insensible à la casse. */
export function headerOf(headers: Record<string, string>, name: string): string {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value.trim();
  }
  return '';
}

/** Un paramètre de requête, nettoyé ; chaîne vide si absent. */
function queryOf(query: Record<string, string>, name: string): string {
  return (query[name] ?? '').trim();
}

/** GET : l'instantané réel du ticket demandé. */
async function serveSnapshot(request: CiWebRequest, deps: AppDeps): Promise<CiWebResponse> {
  const issueKey = queryOf(request.query, 'issueKey');
  if (issueKey === '') return demoJson(400, { error: 'missing-issue-key' });
  const snapshot = await buildDemoSnapshot(deps, {
    issueKey,
    site: queryOf(request.query, 'site'),
    repo: queryOf(request.query, 'repo') || undefined,
    branch: queryOf(request.query, 'branch') || undefined,
  });
  if (snapshot === null) return demoJson(404, { error: 'issue-not-found', issueKey });
  return demoJson(200, snapshot);
}

/** Le jeton d'amorçage configuré sur l'environnement ; vide = désactivé. */
function bootstrapToken(): string {
  const raw = process.env[BOOTSTRAP_TOKEN_VAR];
  return typeof raw === 'string' ? raw.trim() : '';
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Lit le corps du bootstrap ; `null` si la forme n'est pas la bonne. */
export function parseBootstrapBody(raw: string): {
  issueKey: string;
  ciKey: string;
  cast: BootstrapCast;
} | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const source = body as Record<string, unknown>;
  if (asString(source['action']) !== 'bootstrap') return null;
  const issueKey = asString(source['issueKey']);
  const ciKey = asString(source['ciKey']);
  const cast = (source['cast'] ?? {}) as Record<string, unknown>;
  const developer = asString(cast['developer']);
  const tester = asString(cast['tester']);
  const owner = asString(cast['owner']);
  if (issueKey === '' || ciKey === '' || developer === '' || tester === '' || owner === '') {
    return null;
  }
  return { issueKey, ciKey, cast: { developer, tester, owner } };
}

/** POST : amorçage protégé par jeton. */
async function bootstrap(request: CiWebRequest, deps: AppDeps): Promise<CiWebResponse> {
  const expected = bootstrapToken();
  if (expected === '') return demoJson(403, { error: 'bootstrap-disabled' });
  if (!safeCompareHex(headerOf(request.headers, 'x-bootstrap-token'), expected)) {
    return demoJson(403, { error: 'invalid-token' });
  }
  const input = parseBootstrapBody(request.body);
  if (input === null) return demoJson(400, { error: 'invalid-payload' });
  const result = await bootstrapDemoData(deps, input);
  if (result === null) return demoJson(404, { error: 'issue-not-found', issueKey: input.issueKey });
  return demoJson(200, result);
}

/** Aiguillage du web trigger : lecture publique, écriture jetonnée. */
export async function handleDemoData(
  request: CiWebRequest,
  deps: AppDeps,
): Promise<CiWebResponse> {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: { ...CORS_HEADERS }, body: '' };
  if (method === 'GET') return serveSnapshot(request, deps);
  if (method === 'POST') return bootstrap(request, deps);
  return demoJson(405, { error: 'method-not-allowed' });
}
