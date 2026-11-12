/**
 * Où la démo lit ses données, et sur quel ticket.
 *
 * Par défaut, la démo du site public lit l'état RÉEL de l'app installée sur le
 * site de démonstration Jira (web trigger `demo-data`, lot
 * `app-donnees-reelles`) : le même ticket, les mêmes critères, la même
 * couverture, lus dans Forge SQL et dans Jira. Le jeu PAY-123 embarqué dans le
 * dépôt reste le repli quand le réseau manque.
 *
 * Ces valeurs sont publiques par nature : l'URL du web trigger ne donne accès
 * qu'à une lecture pseudonymisée (aucun identifiant de compte ne sort).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** URL du web trigger `demo-data` (lecture seule). */
export const LIVE_ENDPOINT: string =
  import.meta.env.VITE_PROOF_DEMO_URL ??
  'https://b8d18d82-727c-47f9-9453-41e2309b7647.webtrigger.atlassian.app/public/0friQZ9-Ojl2OdCfYPCglQCfGjE';

/** Le ticket lu en direct. */
export const LIVE_ISSUE_KEY: string = import.meta.env.VITE_PROOF_DEMO_ISSUE ?? 'PRF-1';

/** Le site Jira d'origine, affiché comme provenance. */
export const LIVE_SITE: string =
  import.meta.env.VITE_PROOF_DEMO_SITE ?? 'one-atlas-cndz.atlassian.net';

/** Dépôt et branche du dernier passage de CI (pour rejouer un vrai résumé). */
export const LIVE_REPO: string = 'BaptisteFaisy/preuve-a-l-appui';
export const LIVE_BRANCH: string = 'feature/PRF-1-refusal-email';

/** Délai maximal d'attente de la lecture, en millisecondes. */
export const LIVE_TIMEOUT_MS = 8000;
