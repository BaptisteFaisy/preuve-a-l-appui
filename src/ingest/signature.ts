/**
 * Signature et authentification de l'entrée CI (SPEC §10, FP-06).
 *
 * Utilise uniquement `node:crypto` (zéro dépendance externe).
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Fenêtre anti-rejeu par défaut : 5 minutes (300 secondes). */
export const DEFAULT_ANTI_REPLAY_WINDOW_SECS = 300;

export interface CiSignatureHeaders {
  readonly key: string;
  readonly timestamp: string;
  readonly signature: string;
}

/** Extrait de manière insensible à la casse les en-têtes d'authentification CI. */
export function extractCiHeaders(headers: Record<string, string>): CiSignatureHeaders {
  let key = '';
  let timestamp = '';
  let signature = '';

  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower === 'x-ci-key' || lower === 'ci-key') key = value.trim();
    else if (lower === 'x-ci-timestamp' || lower === 'ci-timestamp') timestamp = value.trim();
    else if (lower === 'x-ci-signature' || lower === 'ci-signature') signature = value.trim();
  }

  return { key, timestamp, signature };
}

/** Calcule le HMAC SHA-256 du message d'authentification (`timestamp.body`). */
export function computeHmacSha256(secret: string, timestamp: string, rawBody: string): string {
  const payload = `${timestamp}.${rawBody}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Compare deux chaînes en temps constant pour éviter les attaques temporelles. */
export function safeCompareHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Vérifie si l'horodatage est situé dans la fenêtre anti-rejeu.
 * Accepte les timestamps en secondes ou millisecondes, ou format ISO.
 */
export function isTimestampFresh(
  timestamp: string,
  nowIso: string,
  windowSecs = DEFAULT_ANTI_REPLAY_WINDOW_SECS,
): boolean {
  if (!timestamp) return false;
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) return false;

  let tsMs: number;
  if (/^\d+$/.test(timestamp)) {
    const num = Number(timestamp);
    tsMs = timestamp.length <= 10 ? num * 1000 : num;
  } else {
    tsMs = Date.parse(timestamp);
  }

  if (Number.isNaN(tsMs)) return false;
  const diffSecs = Math.abs(nowMs - tsMs) / 1000;
  return diffSecs <= windowSecs;
}

export interface VerifyCiSignatureInput {
  readonly secret: string;
  readonly timestamp: string;
  readonly signature: string;
  readonly rawBody: string;
  readonly nowIso: string;
  readonly windowSecs?: number;
}

export type SignatureVerificationResult =
  | { ok: true }
  | { ok: false; reason: 'replayed' | 'invalid_signature' };

/** Vérifie l'authenticité d'une requête de CI : anti-rejeu puis signature HMAC. */
export function verifyCiSignature(input: VerifyCiSignatureInput): SignatureVerificationResult {
  const windowSecs = input.windowSecs ?? DEFAULT_ANTI_REPLAY_WINDOW_SECS;
  if (!isTimestampFresh(input.timestamp, input.nowIso, windowSecs)) {
    return { ok: false, reason: 'replayed' };
  }
  const expected = computeHmacSha256(input.secret, input.timestamp, input.rawBody);
  const normalizedSignature = input.signature.replace(/^sha256=/, '');
  if (!safeCompareHex(expected, normalizedSignature)) {
    return { ok: false, reason: 'invalid_signature' };
  }
  return { ok: true };
}
