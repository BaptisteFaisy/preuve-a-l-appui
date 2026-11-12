/**
 * Le jeu de données réel embarqué dans le site public (lot `app-runs-on-atlassian`).
 *
 * L'app installée écrit son instantané pseudonymisé dans une propriété du
 * ticket Jira ; l'outil `tools/refresh-live-snapshot.mjs` la lit et la versionne
 * dans `site/public/live-snapshot.json`. Le site l'importe **à la
 * construction** : la page reste entièrement statique (pas d'appel réseau à
 * l'exécution, pas de CORS) et l'app n'a besoin d'aucun web trigger dynamique —
 * c'est la condition de l'éligibilité « Runs on Atlassian ».
 *
 * Si le fichier est absent ou illisible, le site bascule sur le jeu PAY-123
 * embarqué et l'affiche comme tel.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DemoSnapshotData } from '../../../src/demo-contract.js';
import bundled from '../../public/live-snapshot.json';

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

/** L'instantané embarqué, ou `null` s'il n'est pas exploitable. */
export function bundledSnapshot(): DemoSnapshotData | null {
  return isSnapshot(bundled) ? bundled : null;
}
