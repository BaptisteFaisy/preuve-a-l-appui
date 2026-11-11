/**
 * Traitement de la requête du web trigger `ci-results` (SPEC §10, §17, FP-06).
 *
 * Ordre imposé par le SPEC §17, point 1 : vérifier la signature, ranger le
 * résumé dans la file, répondre aussitôt. Rien de lourd ici — la mise à jour
 * des preuves est faite par le consommateur (`src/ingest/consume.ts`).
 *
 * Authentification (SPEC §10) : la clé de projet circule dans un en-tête, son
 * empreinte SHA-256 retrouve le projet en base (`settings.ciKeyHash`) ; le
 * corps est signé HMAC-SHA256 avec cette clé et l'horodatage, la comparaison
 * est en temps constant, et l'horodatage est refusé hors de la fenêtre
 * anti-rejeu.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { createHash } from 'node:crypto';
import type { AppDeps } from '../deps.js';
import type { CiWebRequest, CiWebResponse } from '../handlers/ingest.js';
import { ciText } from '../i18n/ci.js';
import { TEST_STATES, isObject, parseEnum, toNumber } from '../db/mapping-common.js';
import type { CiBatch, CiSummary, Language, TestOutcome, TestState } from '../types.js';
import { BatchReassembler } from './batching.js';
import { extractCiHeaders, verifyCiSignature } from './signature.js';

/** Charge utile maximale acceptée : la limite du web trigger Forge (SPEC §19). */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** Registre des lots partiels du runtime chaud ; injectable en test. */
export const sharedReassembler = new BatchReassembler();

function jsonResponse(statusCode: number, payload: Record<string, unknown>): CiWebResponse {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function errorResponse(statusCode: number, key: string, language: Language): CiWebResponse {
  return jsonResponse(statusCode, { error: key, message: ciText(key, language) });
}

/** Empreinte de la clé de projet : c'est elle qui est rangée en base. */
export function hashCiKey(key: string): string {
  return createHash('sha256').update(key.trim(), 'utf8').digest('hex');
}

/** Un résultat de test lu de façon défensive : état illisible → `absent`. */
export function toTestOutcome(raw: unknown): TestOutcome {
  const source = isObject(raw) ? raw : {};
  return {
    name: typeof source['name'] === 'string' ? source['name'] : '',
    state: parseEnum<TestState>(source['state'], TEST_STATES, 'absent'),
    durationMs: toNumber(source['durationMs']),
  };
}

/**
 * Lit un résumé de CI. Noms et états seulement : tout autre champ est ignoré,
 * donc aucun journal ne peut entrer dans l'app (SPEC §20).
 */
export function toCiSummary(raw: unknown): CiSummary | null {
  if (!isObject(raw)) return null;
  const { repo, branch, commit, tests } = raw;
  if (typeof repo !== 'string' || typeof branch !== 'string' || typeof commit !== 'string') {
    return null;
  }
  if (!Array.isArray(tests)) return null;
  return {
    repo,
    branch,
    commit,
    mainBranch: raw['mainBranch'] === true,
    tests: tests.map(toTestOutcome),
    receivedAt: typeof raw['receivedAt'] === 'string' ? raw['receivedAt'] : '',
  };
}

/** Un lot découpé (`CiBatch`) ou un résumé d'un seul tenant (`CiSummary`). */
export type CiPayload = { batch: CiBatch } | { summary: CiSummary };

export function parseCiPayload(rawBody: string): CiPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;

  const inner = toCiSummary(parsed['summary']);
  if (inner !== null && typeof parsed['runId'] === 'string' && typeof parsed['index'] === 'number') {
    return {
      batch: {
        runId: parsed['runId'],
        index: parsed['index'],
        total: toNumber(parsed['total'], 1),
        summary: inner,
      },
    };
  }

  const summary = toCiSummary(parsed);
  return summary === null ? null : { summary };
}

/** Vérifie l'authentification ; renvoie le projet trouvé ou la réponse d'erreur. */
async function authenticate(
  request: CiWebRequest,
  deps: AppDeps,
): Promise<{ projectId: string; language: Language } | CiWebResponse> {
  const { key, timestamp, signature } = extractCiHeaders(request.headers);
  if (key.length === 0 || timestamp.length === 0 || signature.length === 0) {
    return errorResponse(401, 'ci.ingest.missing_auth', 'en');
  }

  const settings = await deps.store.findProjectByCiKeyHash(hashCiKey(key));
  if (settings === null) {
    return errorResponse(401, 'ci.ingest.invalid_signature', 'en');
  }

  const verdict = verifyCiSignature({
    secret: key,
    timestamp,
    signature,
    rawBody: request.body,
    nowIso: deps.clock.now(),
  });
  if (verdict.ok) return { projectId: settings.projectId, language: settings.language };

  const reason =
    verdict.reason === 'replayed' ? 'ci.ingest.replay_rejected' : 'ci.ingest.invalid_signature';
  return errorResponse(401, reason, settings.language);
}

/** Réponse « lot mis en attente » : le run n'est pas encore complet. */
function bufferedResponse(batch: CiBatch, language: Language): CiWebResponse {
  return jsonResponse(202, {
    status: 'buffered',
    runId: batch.runId,
    message: ciText('ci.ingest.batched', language, {
      runId: batch.runId,
      index: batch.index + 1,
      total: batch.total,
    }),
  });
}

/**
 * Traite la requête du web trigger : authentification, réassemblage des lots,
 * publication sur la file `proof-ci`, réponse immédiate (SPEC §17, point 1).
 */
export async function processCiWebRequest(
  request: CiWebRequest,
  deps: AppDeps,
  reassembler: BatchReassembler = sharedReassembler,
): Promise<CiWebResponse> {
  if (request.method.toUpperCase() !== 'POST') {
    return errorResponse(405, 'ci.ingest.method_not_allowed', 'en');
  }
  if (Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) {
    return errorResponse(413, 'ci.ingest.payload_too_large', 'en');
  }

  const auth = await authenticate(request, deps);
  if ('statusCode' in auth) return auth;

  const now = deps.clock.now();
  const payload = parseCiPayload(request.body);
  if (payload === null) {
    return errorResponse(400, 'ci.ingest.invalid_payload', auth.language);
  }

  reassembler.prune();
  const runId = 'batch' in payload ? payload.batch.runId : deps.ids.next('run');
  const assembled = 'batch' in payload ? reassembler.addBatch(payload.batch) : payload.summary;
  if (assembled === null) {
    return 'batch' in payload
      ? bufferedResponse(payload.batch, auth.language)
      : errorResponse(400, 'ci.ingest.invalid_payload', auth.language);
  }

  const summary: CiSummary = { ...assembled, receivedAt: assembled.receivedAt || now };
  await deps.queue.publish({ runId, projectId: auth.projectId, summary });

  return jsonResponse(202, {
    status: 'accepted',
    runId,
    message: ciText('ci.ingest.accepted', auth.language, { runId }),
  });
}
