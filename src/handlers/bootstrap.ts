/**
 * Point d'entrée de l'amorçage (lot `app-runs-on-atlassian`).
 *
 * L'amorçage écrit le scénario de démonstration dans une installation réelle :
 * il crée les tables si besoin, puis pose les critères, les preuves et les
 * réglages d'un ticket — sur le site de démonstration Jira.
 *
 * Le déclencheur est **statique** : la réponse est l'une des sorties
 * déclarées dans le manifest, jamais une charge utile construite à
 * l'exécution. C'est la condition pour que l'app reste éligible « Runs on
 * Atlassian » (un déclencheur dynamique pourrait faire sortir des données).
 *
 * L'écriture est protégée par le jeton de la variable d'app
 * `FORGE_USER_VAR_DEMO_BOOTSTRAP_TOKEN`, comparé en temps constant ; variable
 * absente → refus (403), jamais d'amorçage ouvert.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import { applySchema } from '../db/schema';
import { forgeDdlRunner } from '../db/sql-client';
import type { DdlRunner } from '../db/sql-client';
import { safeCompareHex } from '../ingest/signature';
import { bootstrapDemoData } from '../sample/bootstrap';
import type { BootstrapCast, BootstrapFlow } from '../sample/bootstrap';

/** Variable d'app portant le jeton d'amorçage (jamais dans le dépôt). */
export const BOOTSTRAP_TOKEN_VAR = 'FORGE_USER_VAR_DEMO_BOOTSTRAP_TOKEN';

/** Requête du web trigger : en-têtes et corps bruts. */
export interface BootstrapRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
}

/** Ce que renvoie le handler : un code et la sortie statique correspondante. */
export interface BootstrapOutcome {
  readonly statusCode: number;
  readonly outputKey: string;
}

/** Lecture d'en-tête insensible à la casse. */
export function headerOf(headers: Record<string, string>, name: string): string {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value.trim();
  }
  return '';
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Le jeton d'amorçage configuré sur l'environnement ; vide = désactivé. */
export function bootstrapToken(): string {
  const raw = process.env[BOOTSTRAP_TOKEN_VAR];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** L'action demandée dans le corps ; chaîne vide si le JSON est invalide. */
export function actionOf(raw: string): string {
  try {
    const body = JSON.parse(raw) as unknown;
    if (typeof body !== 'object' || body === null) return '';
    return asString((body as Record<string, unknown>)['action']);
  } catch {
    return '';
  }
}

/** Lit le corps de l'amorçage ; `null` si la forme n'est pas la bonne. */
export function parseBootstrapBody(raw: string): {
  issueKey: string;
  ciKey: string;
  cast: BootstrapCast;
  flow?: BootstrapFlow;
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
  // Le compte de l'agent est optionnel : à défaut, c'est celui du développeur.
  const agent = asString(cast['agent']);
  const flow = parseFlow(source['flow']);
  return {
    issueKey,
    ciKey,
    cast: { developer, tester, owner, ...(agent ? { agent } : {}) },
    ...(flow ? { flow } : {}),
  };
}

/** Le flux de gestes humains (attestations, dérogations), s'il est fourni. */
export function parseFlow(raw: unknown): BootstrapFlow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const readItem = (item: unknown): Record<string, string> =>
    typeof item === 'object' && item !== null ? (item as Record<string, string>) : {};
  const attest = (Array.isArray(source['attest']) ? source['attest'] : [])
    .map(readItem)
    .filter((item) => asString(item['code']) !== '' && asString(item['accountId']) !== '')
    .map((item) => ({ code: asString(item['code']), accountId: asString(item['accountId']) }));
  const waive = (Array.isArray(source['waive']) ? source['waive'] : [])
    .map(readItem)
    .filter(
      (item) =>
        asString(item['code']) !== '' &&
        asString(item['accountId']) !== '' &&
        asString(item['role']) !== '' &&
        asString(item['reason']) !== '',
    )
    .map((item) => ({
      code: asString(item['code']),
      accountId: asString(item['accountId']),
      role: asString(item['role']),
      reason: asString(item['reason']),
    }));
  if (attest.length === 0 && waive.length === 0) return null;
  return { ...(attest.length ? { attest } : {}), ...(waive.length ? { waive } : {}) };
}

/** Écritures : le schéma d'abord, puis l'amorçage du ticket. */
async function write(
  request: BootstrapRequest,
  deps: AppDeps,
  ddl: DdlRunner,
): Promise<BootstrapOutcome> {
  const expected = bootstrapToken();
  if (expected === '') return { statusCode: 403, outputKey: 'forbidden' };
  if (!safeCompareHex(headerOf(request.headers, 'x-bootstrap-token'), expected)) {
    return { statusCode: 403, outputKey: 'forbidden' };
  }
  const action = actionOf(request.body);
  if (action === 'migrate') {
    await applySchema(ddl);
    return { statusCode: 200, outputKey: 'migrated' };
  }
  if (action !== 'bootstrap') return { statusCode: 400, outputKey: 'invalid-payload' };
  const input = parseBootstrapBody(request.body);
  if (input === null) return { statusCode: 400, outputKey: 'invalid-payload' };
  const result = await bootstrapDemoData(deps, input);
  if (result === null) return { statusCode: 404, outputKey: 'not-found' };
  return { statusCode: 200, outputKey: 'ok' };
}

/** Aiguillage : le déclencheur ne fait qu'amorcer, sous jeton. */
export async function handleBootstrap(
  request: BootstrapRequest,
  deps: AppDeps,
  ddl: DdlRunner = forgeDdlRunner,
): Promise<BootstrapOutcome> {
  if (request.method.toUpperCase() !== 'POST') {
    return { statusCode: 405, outputKey: 'method-not-allowed' };
  }
  return write(request, deps, ddl);
}
