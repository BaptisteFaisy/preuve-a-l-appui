/**
 * Adaptateur de notification hors Jira : un webhook d'équipe (SPEC §13, §17).
 *
 * L'app écrit dans Jira et y avertit les gens ; dans une équipe réelle,
 * l'alerte arrive aussi dans le canal de l'équipe. Cette notification est
 * **optionnelle** : elle n'existe que si un administrateur a posé l'URL du
 * webhook dans la variable d'environnement Forge
 * `FORGE_USER_VAR_NOTIFY_WEBHOOK` (même mécanisme que le jeton d'amorçage de
 * `src/handlers/bootstrap.ts`). Variable absente ou vide → **rien ne se
 * passe** : aucun appel, aucune erreur, aucun journal.
 *
 * Le corps envoyé est `{"text": "…"}` : Slack, Teams (connecteur Office 365)
 * et Discord l'acceptent tous les trois, donc un seul adaptateur suffit.
 *
 * Deux contraintes tiennent ici :
 *  - **borné dans le temps** : un canal lent ne doit pas retenir le
 *    consommateur de CI (SPEC §20) — `withTimeout` de `src/collect/http.ts` ;
 *  - **tolérant aux erreurs** : une notification ratée ne doit jamais faire
 *    échouer le traitement d'un résumé de CI (SPEC §17) — toute erreur, tout
 *    délai, tout non-2xx devient `false`, jamais une exception.
 *
 * Forge n'autorise `api.fetch` sortant que vers les domaines déclarés dans le
 * manifest (`permissions.external.fetch.backend`, cf. `manifest.yml`) : Slack,
 * Teams et Discord y sont listés, et l'app n'appelle aucun autre hôte.
 *
 * Seul `src/collect/` importe le runtime Forge (docs/CONTRACTS.md §4bis) ; le
 * transport est injectable, donc les tests n'ouvrent aucun socket.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { WebhookMessage, WebhookNotifier } from '../ports';
import {
  DEFAULT_TIMEOUT_MS,
  defaultExternalFetch,
  jsonInit,
  withTimeout,
  type ExternalFetch,
} from './http';

/** Variable d'app Forge portant l'URL du webhook (jamais dans le dépôt). */
export const NOTIFY_WEBHOOK_VAR = 'FORGE_USER_VAR_NOTIFY_WEBHOOK';

/**
 * Délai maximal d'un envoi (ms) : celui du transport partagé — un canal lent
 * ne doit pas retenir le consommateur de CI (SPEC §20).
 */
export const WEBHOOK_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

export interface WebhookOptions {
  /** URL du webhook ; par défaut la variable d'environnement, relue à l'envoi. */
  readonly url?: string;
  /** Transport injecté (défaut : `api.fetch` du runtime Forge). */
  readonly fetchImpl?: ExternalFetch;
  /** Délai maximal de l'appel, en ms (défaut : `WEBHOOK_TIMEOUT_MS`). */
  readonly timeoutMs?: number;
}

/** L'URL du webhook configurée sur l'environnement ; vide = notification désactivée. */
export function webhookUrl(): string {
  const raw = process.env[NOTIFY_WEBHOOK_VAR];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Y a-t-il un canal à prévenir ? Non = aucun appel ne sera fait. */
export function isWebhookConfigured(url: string = webhookUrl()): boolean {
  return url !== '';
}

/** Le corps accepté par Slack, Teams et Discord : `{"text": "…"}`. */
export function webhookPayload(text: string): { readonly text: string } {
  return { text };
}

/** Un POST borné dans le temps : délai, erreur réseau et non-2xx deviennent `false`. */
async function post(
  url: string,
  text: string,
  transport: ExternalFetch,
  timeoutMs: number,
): Promise<boolean> {
  const response = await withTimeout(
    (signal) => transport(url, { ...jsonInit('POST', webhookPayload(text)), signal }).catch(() => null),
    timeoutMs,
  ).catch(() => null);
  return response?.ok === true;
}

/**
 * Fabrique le notificateur. Sans option, il lit la variable d'environnement à
 * chaque envoi — donc désactiver le webhook ne demande aucun redéploiement.
 */
export function createWebhookNotifier(options: WebhookOptions = {}): WebhookNotifier {
  const transport = options.fetchImpl ?? defaultExternalFetch();
  const timeoutMs = options.timeoutMs ?? WEBHOOK_TIMEOUT_MS;
  return {
    // Lu à chaque accès : couper le canal ne demande aucun redéploiement.
    get enabled(): boolean {
      return (options.url ?? webhookUrl()).trim() !== '';
    },
    async send(message: WebhookMessage): Promise<boolean> {
      const url = (options.url ?? webhookUrl()).trim();
      const text = message.text.trim();
      if (url === '' || text === '') return false;
      return post(url, text, transport, timeoutMs);
    },
  };
}

/** Le notificateur du runtime : celui qu'utilise l'app quand rien n'est injecté. */
export function defaultWebhookNotifier(): WebhookNotifier {
  return createWebhookNotifier();
}
