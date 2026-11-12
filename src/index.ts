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
 *   serveDemoData  → `webtrigger` demo-data (lecture publique + bootstrap jetonné)
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
import { createAppDeps } from './deps';
import type { AppDeps } from './deps';
import type { ActorContext, CiIngestMessage, JobQueue } from './ports';
import { registerResolvers } from './handlers/resolver';
import { createValidator } from './handlers/validator';
import { handleCiResults } from './handlers/ingest';
import { ciOutputKey } from './ingest/webtrigger';
import { handleBootstrap } from './handlers/bootstrap';
import { flatten, toWebRequest } from './webtrigger-adapter';
import type { ForgeWebRequest } from './webtrigger-adapter';
import { onJiraEvent } from './handlers/events';
import { onScheduledTick } from './handlers/scheduled';
import { onCiMessage } from './handlers/consumer';
import { ACTION_KEYS, runAction } from './handlers/dispatch';
import type { GateVerdict } from './types';

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

/**
 * Réponse d'un déclencheur STATIQUE : le nom d'une sortie déclarée dans le
 * manifest. Un déclencheur statique ne renvoie jamais de corps construit à
 * l'exécution — c'est la condition de l'éligibilité « Runs on Atlassian ».
 */
export interface ForgeOutput {
  outputKey: string;
}

/* -------------------------------------------------------- entrée de CI (L4) */

/**
 * Web trigger `bootstrap` : amorçage du scénario de démonstration sur une
 * installation réelle, protégé par jeton. Le déclencheur est **statique** (la
 * réponse est l'une des sorties du manifest) : c'est la condition de
 * l'éligibilité « Runs on Atlassian ».
 */
export async function bootstrapDemo(request: ForgeWebRequest): Promise<ForgeOutput> {
  const outcome = await handleBootstrap(
    {
      method: request.method ?? 'POST',
      headers: flatten(request.headers),
      body: request.body ?? '',
    },
    deps,
  );
  return { outputKey: outcome.outputKey };
}

/**
 * Web trigger `ci-results` : la CI pousse son résumé de résultats. Statique
 * aussi : le code HTTP de la réponse est celui de la sortie déclarée.
 */
export async function ingestResults(request: ForgeWebRequest): Promise<ForgeOutput> {
  const response = await handleCiResults(toWebRequest(request), deps);
  return { outputKey: ciOutputKey(response.statusCode) };
}

/* ------------------------------------------------- événements et file (L4) */

export async function onEvent(payload: Record<string, unknown>): Promise<void> {
  await onJiraEvent(payload, deps);
}

/**
 * Consommateur de la file `proof-ci` : Forge livre l'enveloppe de l'événement
 * (`queueName`, `jobId`, `eventId`, `body`, `context`…), la charge utile est
 * dans `body`. Sans ce déballage, le message est illisible et le consommateur
 * ne fait rien (`ci.consumer.unreadable_message`, vérifié en réel le 12/11).
 */
export async function onMessage(payload: Record<string, unknown>): Promise<void> {
  const body = payload['body'];
  const message = typeof body === 'object' && body !== null ? body : payload;
  await onCiMessage(message as unknown as CiIngestMessage, deps);
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
