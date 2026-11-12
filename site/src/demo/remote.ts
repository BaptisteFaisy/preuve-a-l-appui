/**
 * Lecture de l'état réel de l'app par le site public (lot `site-donnees-reelles`).
 *
 * Le site appelle le web trigger `demo-data` de l'app installée sur le site de
 * démonstration Jira et reçoit l'instantané du ticket : critères, preuves,
 * couverture, statistiques, acteurs, dossier. Le contrat est défini une seule
 * fois, côté app (`src/demo-contract.ts`) ; ici on ne fait que le lire et le
 * vérifier avant de s'y fier.
 *
 * Aucun secret, aucune écriture : la lecture est publique et pseudonymisée.
 * En cas de panne (réseau, app non déployée, CORS), le site ne casse pas : il
 * bascule sur le jeu embarqué et l'affiche.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DemoSnapshotData } from '../../../src/demo-contract.js';
import { LIVE_BRANCH, LIVE_ENDPOINT, LIVE_ISSUE_KEY, LIVE_REPO, LIVE_SITE, LIVE_TIMEOUT_MS } from './config.js';

/** Ce que la lecture rapporte : l'instantané, ou la raison de l'échec. */
export interface LiveRead {
  readonly snapshot: DemoSnapshotData | null;
  readonly error: string;
}

/** Les clés qu'un instantané doit porter pour être exploité. */
const REQUIRED_KEYS = [
  'issue',
  'criteria',
  'evidences',
  'coverage',
  'settings',
  'actors',
] as const;

/** Vrai si la réponse ressemble à un instantané exploitable. */
export function isSnapshot(value: unknown): value is DemoSnapshotData {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return REQUIRED_KEYS.every((key) => key in record);
}

/** L'URL complète de la lecture, paramètres compris. */
export function liveUrl(endpoint: string = LIVE_ENDPOINT): string {
  const url = new URL(endpoint);
  url.searchParams.set('issueKey', LIVE_ISSUE_KEY);
  url.searchParams.set('site', LIVE_SITE);
  url.searchParams.set('repo', LIVE_REPO);
  url.searchParams.set('branch', LIVE_BRANCH);
  return url.toString();
}

/** Lit l'instantané réel ; ne lève jamais, elle rapporte. */
export async function readLiveSnapshot(
  endpoint: string = LIVE_ENDPOINT,
): Promise<LiveRead> {
  if (typeof fetch !== 'function') {
    return { snapshot: null, error: 'fetch indisponible' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = await fetch(liveUrl(endpoint), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { snapshot: null, error: `HTTP ${response.status}` };
    const payload: unknown = await response.json();
    if (!isSnapshot(payload)) return { snapshot: null, error: 'réponse inattendue' };
    return { snapshot: payload, error: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { snapshot: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
