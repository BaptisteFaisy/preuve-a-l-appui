/**
 * Point d'entrée Forge : câblage seul, aucune logique métier.
 *
 * Les sept modules du manifest (SPEC §17) arrivent ici et repartent aussitôt
 * vers leur handler, chacun propriétaire d'un fichier (docs/CONTRACTS.md §3) :
 *
 *   handler        → `jira:issuePanel`, `jira:customField`,
 *                    `jira:projectSettingsPage`, `jira:projectPage`
 *   validateProof  → `jira:workflowValidator`
 *   ingestResults  → `webtrigger` ci-results
 *   onEvent        → `trigger` avi:jira:updated:issue
 *   onScheduled    → `scheduledTrigger` (contrôle nocturne, SPEC §20)
 *   onMessage      → `consumer` proof-ci
 *   dispatch       → `action` et `rovo:mcp` (les 7 outils du SPEC §15)
 *
 * Fichier gelé : un lot n'y touche pas, il implémente son handler.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import Resolver from '@forge/resolver';
import { Queue } from '@forge/events';
import { createAppDeps } from './deps.js';
import type { AppDeps } from './deps.js';
import type { ActorContext, CiIngestMessage, JobQueue } from './ports.js';
import { registerResolvers } from './handlers/resolver.js';
import { createValidator } from './handlers/validator.js';
import { handleCiResults } from './handlers/ingest.js';
import type { CiWebRequest, CiWebResponse } from './handlers/ingest.js';
import { onJiraEvent } from './handlers/events.js';
import { onScheduledTick } from './handlers/scheduled.js';
import { onCiMessage } from './handlers/consumer.js';
import { ACTION_KEYS, runAction } from './handlers/dispatch.js';
import type { GateVerdict } from './types.js';

/** La clé de file doit être celle du module `consumer` du manifest. */
export const QUEUE_KEY = 'proof-ci';

/** Adaptateur minimal de la file Forge vers le port `JobQueue`. */
function createForgeQueue(): JobQueue {
  const queue = new Queue({ key: QUEUE_KEY });
  return {
    async publish(payload: CiIngestMessage) {
      await queue.push({ body: payload as unknown as Record<string, unknown> });
    },
  };
}

const deps: AppDeps = createAppDeps(createForgeQueue());

/** Ce que Forge passe à une fonction : identité et module, jamais un droit. */
export interface ForgeContext {
  principal?: { accountId?: string };
  moduleKey?: string;
  cloudId?: string;
}

/** Contexte d'un appel d'action : MCP est toujours marqué « agent » (SPEC §19). */
function actorContextOf(payload: Record<string, unknown>, context?: ForgeContext): ActorContext {
  const moduleId = context?.moduleKey ?? String(payload['moduleKey'] ?? '');
  const fromMcp = moduleId.startsWith('mcp') || payload['viaMcp'] === true;
  return {
    accountId: context?.principal?.accountId ?? String(payload['accountId'] ?? ''),
    moduleId,
    fromMcp,
    cloudId: context?.cloudId ?? String(payload['cloudId'] ?? ''),
  };
}

/* ------------------------------------------------------------- écrans (L6) */

const resolver = new Resolver();
registerResolvers(resolver, deps);
export const handler = resolver.getDefinitions();

/* --------------------------------------------------- validateur de flux (L3) */

const validator = createValidator(deps);

/** Charge utile documentée au SPEC §19 : clé, configuration, statuts. */
export interface ValidatorPayload {
  issueKey?: string;
  configuration?: Record<string, unknown>;
  transition?: { fromStatus?: string; toStatus?: string };
}

export async function validateProof(payload: ValidatorPayload): Promise<GateVerdict> {
  return validator({
    issueKey: payload.issueKey ?? '',
    configuration: payload.configuration ?? {},
    transition: {
      fromStatus: payload.transition?.fromStatus ?? '',
      toStatus: payload.transition?.toStatus ?? '',
    },
  });
}

/* -------------------------------------------------------- entrée de CI (L4) */

/** Requête web trigger (urlFormat v2) : corps brut, pour la signature. */
export interface ForgeWebRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
}

export async function ingestResults(request: ForgeWebRequest): Promise<CiWebResponse> {
  const raw: CiWebRequest = {
    method: request.method,
    path: request.path,
    headers: request.headers ?? {},
    body: request.body ?? '',
    query: request.query ?? {},
  };
  return handleCiResults(raw, deps);
}

/* ------------------------------------------------- événements et file (L4) */

export async function onEvent(payload: Record<string, unknown>): Promise<void> {
  await onJiraEvent(payload, deps);
}

export async function onMessage(payload: Record<string, unknown>): Promise<void> {
  await onCiMessage(payload as unknown as CiIngestMessage, deps);
}

/* --------------------------------------------- contrôle nocturne (L3, §20) */

export async function onScheduled(payload: Record<string, unknown>): Promise<void> {
  await onScheduledTick(payload, deps);
}

/* -------------------------------------------------- actions et MCP (L5) */

/** Une action Forge est une fonction ordinaire `(payload, context)` (SPEC §15). */
export async function dispatch(
  payload: Record<string, unknown>,
  context?: ForgeContext,
): Promise<unknown> {
  const name = String(payload['action'] ?? payload['name'] ?? '');
  return runAction(name, payload, deps, actorContextOf(payload, context));
}

export { ACTION_KEYS };
