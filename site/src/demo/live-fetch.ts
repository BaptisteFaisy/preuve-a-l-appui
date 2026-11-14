/**
 * La relecture des données réelles, à l'exécution (lot `site-demo-live`).
 *
 * Le site public était figé à sa construction : l'instantané embarqué datait du
 * dernier déploiement, et personne ne pouvait savoir depuis quand. Ce module
 * relit le fichier publié (`config.ts`), délai compris et cache désactivé, pour
 * que la démo parte de l'état courant de l'app installée. La validation de la
 * forme réutilise `isSnapshot` : une seule implémentation, aucune structure ne
 * peut passer au travers.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DemoSnapshotData } from '../../../src/demo-contract.js';
import { RELOAD_TIMEOUT_MS, SNAPSHOT_URL } from './config.js';
import { isSnapshot } from './live-snapshot.js';

/** Le résultat d'une relecture : l'instantané, ou la raison de l'échec. */
export interface ReloadResult {
  /** L'instantané relu, `null` si la relecture a échoué ou n'est pas exploitable. */
  readonly data: DemoSnapshotData | null;
  /** La raison lisible de l'échec, vide quand `data` est là. */
  readonly error: string;
  /** Horodatage de la lecture, côté navigateur. */
  readonly readAt: string;
}

/** Une requête annulée au bout de `ms` : un réseau mort ne bloque pas la démo. */
async function grab(url: string, ms: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Le motif lisible d'un échec, sans jargon ni pile d'appels. */
function reasonOf(error: unknown): string {
  if (!(error instanceof Error)) return 'relecture impossible';
  if (error.name === 'AbortError') return `délai dépassé (${RELOAD_TIMEOUT_MS / 1000} s)`;
  return error.message === '' ? 'relecture impossible' : error.message;
}

/**
 * Relit l'instantané publié. `data` est `null` et `error` expliqué sinon :
 * l'appelant bascule alors sur le jeu embarqué et l'affiche à l'écran.
 */
export async function reloadSnapshot(): Promise<ReloadResult> {
  const readAt = new Date().toISOString();
  // Le paramètre `t` contourne tout cache intermédiaire : la démo demande
  // l'état courant, pas la copie laissée par un autre visiteur.
  const url = `${SNAPSHOT_URL}?t=${Date.now()}`;
  try {
    const parsed = await grab(url, RELOAD_TIMEOUT_MS);
    if (!isSnapshot(parsed)) return { data: null, error: 'fichier illisible', readAt };
    return { data: parsed, error: '', readAt };
  } catch (error: unknown) {
    return { data: null, error: reasonOf(error), readAt };
  }
}
