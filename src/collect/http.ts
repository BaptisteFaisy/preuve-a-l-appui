/**
 * Transport partagé des adaptateurs Forge (lot L9).
 *
 * Trois choses vivent ici pour qu'aucun adaptateur ne les recopie
 * (docs/CONVENTIONS.md, « zéro duplication ») :
 *   1. la borne de délai d'attente de tout appel externe (SPEC §20 : le
 *      validateur répond en moins d'une seconde, rien ne doit pendre) ;
 *   2. la lecture sûre d'une réponse : un corps illisible ou un non-2xx
 *      devient `null`, jamais une exception qui remonterait au domaine ;
 *   3. les transports par défaut branchés sur `@forge/api` (`asApp()`),
 *      injectables pour que les tests ne touchent jamais le réseau.
 *
 * `src/collect/` est le seul endroit du dépôt autorisé à importer `@forge/api`
 * (docs/CONTRACTS.md §4bis) ; le domaine reste pur.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import api from '@forge/api';
import type { RequestInit, Response, Route } from '@forge/api';

/** Délai maximal d'un appel externe (ms). Borne basse : SPEC §20. */
export const DEFAULT_TIMEOUT_MS = 5_000;

/** Ce qu'un adaptateur lit d'une réponse Forge (rien de plus). */
export type HttpResponse = Pick<Response, 'ok' | 'status' | 'json'> & {
  text?: () => Promise<string>;
};

/** Transport produit Forge : `requestJira` / `requestConfluence`. */
export type ProductRequest = (url: Route, init?: RequestInit) => Promise<HttpResponse>;

/** Transport HTTP hors produit (liens libres) : `api.fetch`. */
export type ExternalFetch = (url: string, init?: RequestInit) => Promise<HttpResponse>;

/** Dépassement du délai d'attente : traduit en valeur métier par l'appelant. */
export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`délai dépassé après ${timeoutMs} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Borne une promesse dans le temps. Le timer est toujours nettoyé, donc aucun
 * test ne laisse de minuterie pendante ; le travail lancé reste en vol mais son
 * résultat est ignoré (l'appelant a déjà sa valeur de repli).
 */
export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : 1;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_never, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(limit)), limit);
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** `RequestInit` JSON : le signal est ajouté par le transport borné. */
export function jsonInit(method: string, body?: unknown): RequestInit {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  return body === undefined
    ? { method, headers }
    : { method, headers, body: JSON.stringify(body) };
}

/** Lit un corps JSON sur un 2xx ; `null` sinon ou si le corps n'est pas du JSON. */
export async function readJsonOrNull<T>(response: HttpResponse | null): Promise<T | null> {
  if (!response || !response.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Lit un corps texte si disponible sur un 2xx ; `null` sinon. */
export async function readTextOrNull(response: HttpResponse | null): Promise<string | null> {
  if (!response || !response.ok || typeof response.text !== 'function') return null;
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/** Fabrique les transports par défaut, liés au runtime Forge `asApp()`. */
export function createForgeTransports(): {
  requestJira: ProductRequest;
  requestConfluence: ProductRequest;
  fetch: ExternalFetch;
} {
  return {
    requestJira: (url, init) => api.asApp().requestJira(url, init),
    requestConfluence: (url, init) => api.asApp().requestConfluence(url, init),
    fetch: (url, init) => api.fetch(url, init),
  };
}

/** Transport Jira par défaut (créé à la demande, jamais à l'import). */
export function defaultJiraRequest(): ProductRequest {
  return createForgeTransports().requestJira;
}

/** Transport Confluence par défaut (créé à la demande, jamais à l'import). */
export function defaultConfluenceRequest(): ProductRequest {
  return createForgeTransports().requestConfluence;
}

/** Transport HTTP externe par défaut (créé à la demande, jamais à l'import). */
export function defaultExternalFetch(): ExternalFetch {
  return createForgeTransports().fetch;
}
