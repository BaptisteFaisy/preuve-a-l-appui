/**
 * Adaptation des web triggers Forge (lot `app-donnees-reelles`).
 *
 * La plateforme sérialise la requête et attend la réponse sous une forme qui
 * n'est celle d'aucun handler du dépôt : les en-têtes et les paramètres d'URL
 * arrivent en **tableaux de chaînes** (`{"Content-Type": ["application/json"]}`),
 * le champ de requête s'appelle `queryParameters`, et la réponse doit renvoyer
 * des tableaux sous peine d'un `424 Failed Dependency` — sans aucun log, ce qui
 * rend la panne invisible côté app. Ce module est le seul endroit où cette
 * forme est connue ; le domaine continue de manipuler des chaînes simples.
 *
 * Source : developer.atlassian.com/platform/forge/runtime-reference/web-trigger
 * (Request / Response). Vérifié en réel le 12/11/2026 sur one-atlas-cndz.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { CiWebRequest, CiWebResponse } from './handlers/ingest';

/** Requête web trigger telle que Forge la sérialise (urlFormat v2). */
export interface ForgeWebRequest {
  method?: string;
  path?: string;
  userPath?: string;
  headers?: Record<string, string | string[]>;
  /** Corps brut : la signature HMAC du canal CI en dépend. */
  body?: string;
  queryParameters?: Record<string, string | string[]>;
  /** Toléré : certaines invocations passent encore `query`. */
  query?: Record<string, string | string[]>;
}

/** Réponse web trigger attendue par Forge : en-têtes en tableaux. */
export interface ForgeWebResponse {
  statusCode: number;
  headers: Record<string, string[]>;
  body: string;
}

/** Première valeur d'un en-tête ou d'un paramètre multi-valué. */
export function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

/** Aplatit un en-tête ou une requête multi-valuée en chaînes simples. */
export function flatten(
  source: Record<string, string | string[]> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(source ?? {})) out[name] = firstValue(value);
  return out;
}

/** Requête Forge → contrat interne du handler. */
export function toWebRequest(request: ForgeWebRequest): CiWebRequest {
  return {
    method: request.method ?? 'GET',
    path: request.path ?? '',
    headers: flatten(request.headers),
    body: request.body ?? '',
    query: flatten(request.queryParameters ?? request.query),
  };
}

/** Réponse interne → ce que Forge exige. */
export function toForgeResponse(response: CiWebResponse): ForgeWebResponse {
  const headers: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(response.headers)) headers[name] = [value];
  return { statusCode: response.statusCode, headers, body: response.body };
}
