/**
 * Où la démo lit ses données, et à quelles conditions.
 *
 * La démo du site public relit **à l'exécution** l'instantané pseudonymisé que
 * l'app installée écrit dans le ticket Jira (`proof-live-snapshot`). Ce fichier
 * est publié sur la même origine que le site (GitHub Pages) par le workflow
 * `live-refresh.yml`, qui rejoue `tools/refresh-live-snapshot.mjs` toutes les
 * dix minutes : la démo part donc de l'état RÉEL de l'app, et affiche l'âge de
 * cet état. Le jeu PAY-123 embarqué reste le repli quand la relecture échoue.
 *
 * L'app, elle, garde deux déclencheurs **statiques** : le site lit un fichier
 * public, jamais l'app en direct. C'est ce qui préserve l'éligibilité « Runs on
 * Atlassian » (docs/LIVE-DEMO.md §6).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** L'URL de base du site, posée par Vite (`site/vite.config.ts`, `base`). */
const BASE_URL: string = (import.meta.env?.BASE_URL as string | undefined) ?? '/preuve-a-l-appui/';

/** Où la démo relit les données réelles : la même origine que le site. */
export const SNAPSHOT_URL: string = `${BASE_URL}live-snapshot.json`;

/** Délai maximal d'une relecture, en millisecondes : au-delà, on tombe au repli. */
export const RELOAD_TIMEOUT_MS = 6000;

/** Fréquence de mise à jour de l'âge affiché, en millisecondes. */
export const FRESHNESS_TICK_MS = 30_000;
