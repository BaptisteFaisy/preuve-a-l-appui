/**
 * Le catalogue de démonstration — la SEULE source des histoires de tickets.
 *
 * Chaque entrée est un ticket de l'environnement réel et **sa** histoire :
 * ses propres critères d'acceptation (cohérents avec son résumé), ses preuves
 * de plusieurs types, ses gestes humains (attestations, dérogations), ses
 * paires test ↔ critère, parfois une révision de critère, parfois un critère
 * encore proposé.
 *
 * Ce que le catalogue ne contient pas :
 * - PRF-1 : la vedette du site de démonstration. Ses quatre critères et ses
 *   trois preuves sont en place et référencés par les tests du site
 *   (`tests/site/live-data.test.ts`) ; le rejoueur ne touche jamais à ce
 *   ticket ;
 * - aucun identifiant de compte : les personnes sont nommées par rôle
 *   (`cast.mjs`), le rejoueur les résout au moment de jouer.
 *
 * La forme du scénario est celle du socle gelé `src/sample/scenario.ts` :
 * la garde `tests/tools/demo-scenarios.test.ts` la relit avec `parseScenario`
 * et refuse un catalogue mal formé.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import prf2 from './prf-2.mjs';
import prf3 from './prf-3.mjs';
import prf4 from './prf-4.mjs';
import prf5 from './prf-5.mjs';
import prf6 from './prf-6.mjs';
import prf7 from './prf-7.mjs';
import prf8 from './prf-8.mjs';
import prf9 from './prf-9.mjs';

/** Les huit tickets de démonstration, dans l'ordre des clés. */
export const DEMO_SCENARIOS = Object.freeze([
  prf2,
  prf3,
  prf4,
  prf5,
  prf6,
  prf7,
  prf8,
  prf9,
]);

export default DEMO_SCENARIOS;
