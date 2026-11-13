/**
 * Les sources des chiffres de la vitrine (lot `site-vitrine-confiance`).
 *
 * Règle du lot : un chiffre affiché doit être vérifiable. Ceux qui viennent de
 * l'app installée se lisent dans l'instantané versionné
 * (`site/public/live-snapshot.json`, régénéré par
 * `tools/refresh-live-snapshot.mjs`) ; ceux qui viennent du dépôt sont écrits
 * en dur ici, avec la date de mesure et un lien vers le fichier qui le prouve.
 *
 * Aucun de ces chiffres n'est inventé : la suite de tests du dépôt comptait
 * 902 tests verts le 13 novembre 2026 (`npx vitest run`, 78 fichiers), et
 * `package.json` ne déclare comme dépendances que des modules `@forge/*`
 * fournis par la plateforme — d'où « 0 dépendance à l'exécution » hors
 * plateforme. La valeur affichée est un plancher (« 900+ ») : elle reste vraie
 * quand la suite s'agrandit, et le compte exact est écrit à côté, avec sa
 * date.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** Le dépôt public du projet. */
export const REPO_URL = 'https://github.com/Tradoooo/preuve-a-l-appui';

/** Un fichier du dépôt, sur la branche par défaut. */
export function repoFile(path: string): string {
  return `${REPO_URL}/blob/main/${path}`;
}

/** L'instantané réel versionné : la preuve des chiffres de l'app. */
export const SNAPSHOT_SOURCE_URL = repoFile('site/public/live-snapshot.json');

/** Le manifest et la doc d'éligibilité : la preuve du badge. */
export const ELIGIBILITY_SOURCE_URL = repoFile('docs/LIVE-DEMO.md');

/** `package.json` du dépôt : la preuve de « 0 dépendance à l'exécution ». */
export const PACKAGE_SOURCE_URL = repoFile('package.json');

/** La commande qui compte les tests verts. */
export const GREEN_TESTS_FLOOR = 900;

/** Le compte exact mesuré à la date ci-dessous (aucune promesse au-delà). */
export const GREEN_TESTS_MEASURED = 902;

/** Les dépendances à l'exécution hors modules `@forge/*` de la plateforme. */
export const RUNTIME_DEPENDENCIES = 0;

/** Le jour où les chiffres du dépôt ont été mesurés. */
export const REPO_MEASURED_ON = '2026-11-13T00:00:00Z';
