/**
 * Tests de la signature de l'entrée de CI (SPEC §10 : clé de projet, HMAC du
 * corps, fenêtre anti-rejeu ; comparaison en temps constant).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANTI_REPLAY_WINDOW_SECS,
  computeHmacSha256,
  extractCiHeaders,
  isTimestampFresh,
  safeCompareHex,
  verifyCiSignature,
} from '../../src/ingest/signature.js';

const SECRET = 'ci-project-key';
const NOW = '2026-11-11T08:00:00.000Z';
const BODY = '{"repo":"pay/paiements","branch":"feature/PAY-123-x"}';

describe('extractCiHeaders', () => {
  it('lit les trois en-têtes, quelle que soit leur casse', () => {
    const headers = extractCiHeaders({
      'X-CI-Key': 'k',
      'x-ci-timestamp': '123',
      'X-Ci-Signature': 'abc',
    });
    expect(headers).toEqual({ key: 'k', timestamp: '123', signature: 'abc' });
  });

  it('accepte les noms courts sans préfixe', () => {
    const headers = extractCiHeaders({
      'ci-key': 'k',
      'ci-timestamp': '123',
      'ci-signature': 'abc',
    });
    expect(headers.key).toBe('k');
    expect(headers.timestamp).toBe('123');
    expect(headers.signature).toBe('abc');
  });

  it('rend des chaînes vides quand les en-têtes manquent', () => {
    expect(extractCiHeaders({})).toEqual({ key: '', timestamp: '', signature: '' });
  });
});

describe('computeHmacSha256', () => {
  it('signe le couple horodatage + corps brut', () => {
    const signature = computeHmacSha256(SECRET, '1700000000', BODY);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(computeHmacSha256(SECRET, '1700000000', BODY)).toBe(signature);
  });

  it('change dès que le corps ou l’horodatage change', () => {
    const base = computeHmacSha256(SECRET, '1700000000', BODY);
    expect(computeHmacSha256(SECRET, '1700000001', BODY)).not.toBe(base);
    expect(computeHmacSha256(SECRET, '1700000000', `${BODY} `)).not.toBe(base);
    expect(computeHmacSha256('autre-clé', '1700000000', BODY)).not.toBe(base);
  });
});

describe('safeCompareHex', () => {
  it('compare en temps constant et refuse les longueurs différentes', () => {
    expect(safeCompareHex('abcd', 'abcd')).toBe(true);
    expect(safeCompareHex('abcd', 'abce')).toBe(false);
    expect(safeCompareHex('abcd', 'abc')).toBe(false);
  });
});

describe('isTimestampFresh', () => {
  it('accepte un horodatage dans la fenêtre, en secondes ou en ISO', () => {
    const nowMs = Date.parse(NOW);
    expect(isTimestampFresh(String(Math.floor(nowMs / 1000)), NOW)).toBe(true);
    expect(isTimestampFresh(String(nowMs), NOW)).toBe(true);
    expect(isTimestampFresh(NOW, NOW)).toBe(true);
  });

  it('refuse un horodatage trop ancien (rejeu)', () => {
    const old = String(Math.floor(Date.parse(NOW) / 1000) - DEFAULT_ANTI_REPLAY_WINDOW_SECS - 60);
    expect(isTimestampFresh(old, NOW)).toBe(false);
  });

  it('refuse un horodatage trop futur ou illisible', () => {
    const future = String(Math.floor(Date.parse(NOW) / 1000) + DEFAULT_ANTI_REPLAY_WINDOW_SECS + 60);
    expect(isTimestampFresh(future, NOW)).toBe(false);
    expect(isTimestampFresh('pas-une-date', NOW)).toBe(false);
    expect(isTimestampFresh('', NOW)).toBe(false);
  });
});

describe('verifyCiSignature', () => {
  const timestamp = String(Math.floor(Date.parse(NOW) / 1000));

  it('accepte une signature valide, avec ou sans préfixe sha256=', () => {
    const signature = computeHmacSha256(SECRET, timestamp, BODY);
    expect(verifyCiSignature({ secret: SECRET, timestamp, signature, rawBody: BODY, nowIso: NOW }).ok).toBe(true);
    expect(
      verifyCiSignature({ secret: SECRET, timestamp, signature: `sha256=${signature}`, rawBody: BODY, nowIso: NOW }).ok,
    ).toBe(true);
  });

  it('refuse une signature invalide', () => {
    const result = verifyCiSignature({
      secret: SECRET,
      timestamp,
      signature: 'f'.repeat(64),
      rawBody: BODY,
      nowIso: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('refuse un corps modifié après signature', () => {
    const signature = computeHmacSha256(SECRET, timestamp, BODY);
    const result = verifyCiSignature({
      secret: SECRET,
      timestamp,
      signature,
      rawBody: `${BODY.slice(0, -1)},"tests":[]}`,
      nowIso: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it('refuse une requête rejouée hors de la fenêtre', () => {
    const oldTimestamp = String(Math.floor(Date.parse(NOW) / 1000) - 3600);
    const signature = computeHmacSha256(SECRET, oldTimestamp, BODY);
    const result = verifyCiSignature({
      secret: SECRET,
      timestamp: oldTimestamp,
      signature,
      rawBody: BODY,
      nowIso: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'replayed' });
  });

  it('refuse la mauvaise clé de projet', () => {
    const signature = computeHmacSha256('autre-clé', timestamp, BODY);
    const result = verifyCiSignature({ secret: SECRET, timestamp, signature, rawBody: BODY, nowIso: NOW });
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });
});
