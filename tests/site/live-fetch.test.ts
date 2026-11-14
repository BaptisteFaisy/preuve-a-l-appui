/**
 * La relecture des données réelles, à l'exécution (lot `site-demo-live`).
 *
 * Le site public était figé au dernier déploiement : ces tests verrouillent le
 * comportement contraire — l'instantané est relu, avec un délai, sans cache, et
 * un repli expliqué quand la relecture échoue. L'âge affiché est calculé ici,
 * sans DOM ni réseau.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ageLabel, ageTone, stampLabel } from '../../site/src/demo/freshness.js';
import { reloadSnapshot } from '../../site/src/demo/live-fetch.js';

const FIXTURE = fileURLToPath(new URL('../../site/public/live-snapshot.json', import.meta.url));
const REAL = readFileSync(FIXTURE, 'utf8');

/** Une réponse au format de `fetch`, sans dépendre du réseau. */
function reply(status: number, body: string): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) };
}

afterEach(() => vi.unstubAllGlobals());

describe('relecture de l\'instantané publié', () => {
  it('rend les données réelles et l\'heure de la lecture', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, REAL)));
    const out = await reloadSnapshot();
    expect(out.error).toBe('');
    expect(out.data?.issue.key).toBe('PRF-1');
    expect(out.data?.coverage?.proven).toBe(2);
    expect(out.readAt).not.toBe('');
  });

  it('demande sans cache et contourne les caches intermédiaires', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => reply(200, REAL));
    vi.stubGlobal('fetch', fetchMock);
    await reloadSnapshot();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('live-snapshot.json?t=');
    expect(init.cache).toBe('no-store');
    expect(init.method).toBe('GET');
  });

  it('retombe sur le repli avec une raison lisible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(404, '{}')));
    const out = await reloadSnapshot();
    expect(out.data).toBeNull();
    expect(out.error).toBe('HTTP 404');
  });

  it('refuse un fichier qui n\'est pas un instantané', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, '{"issue":{}}')));
    const out = await reloadSnapshot();
    expect(out.data).toBeNull();
    expect(out.error).toBe('fichier illisible');
  });

  it('dit le délai dépassé plutôt que d\'attendre un réseau mort', async () => {
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw abort;
    }));
    const out = await reloadSnapshot();
    expect(out.data).toBeNull();
    expect(out.error).toContain('délai dépassé');
  });
});

describe('l\'âge des données affichées', () => {
  const HOUR = 3_600_000;
  const NOW = Date.parse('2026-11-14T14:58:00.000Z');

  it('se compte en secondes, minutes, heures puis jours', () => {
    expect(ageLabel('2026-11-14T14:57:40.000Z', NOW, 'fr')).toBe('il y a 20 s');
    expect(ageLabel('2026-11-14T14:53:00.000Z', NOW, 'fr')).toBe('il y a 5 min');
    expect(ageLabel('2026-11-14T07:58:00.000Z', NOW, 'fr')).toBe('il y a 7 h');
    expect(ageLabel('2026-11-10T14:58:00.000Z', NOW, 'fr')).toBe('il y a 4 j');
    expect(ageLabel('2026-11-14T07:58:00.000Z', NOW, 'en')).toBe('7 h ago');
  });

  it('reste vide sur un horodatage illisible ou futur', () => {
    expect(ageLabel('', NOW, 'fr')).toBe('');
    expect(ageLabel('pas une date', NOW, 'fr')).toBe('');
    expect(ageLabel('2026-11-14T15:58:00.000Z', NOW, 'fr')).toBe('il y a 0 s');
  });

  it('colore selon la fraîcheur : quinze minutes ou moins, c\'est frais', () => {
    expect(ageTone(new Date(NOW - 4 * 60 * 1000).toISOString(), NOW)).toBe('fresh');
    expect(ageTone(new Date(NOW - HOUR).toISOString(), NOW)).toBe('older');
    expect(ageTone('', NOW)).toBe('unknown');
  });

  it('affiche une date lisible, jamais un horodatage brut', () => {
    const fr = stampLabel('2026-11-13T17:09:56.822Z', 'fr');
    expect(fr).toContain('13');
    expect(fr).toContain('18:09');
    expect(stampLabel('', 'fr')).toBe('');
    expect(stampLabel('pas une date', 'fr')).toBe('');
  });
});
