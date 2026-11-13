/**
 * La distribution des rôles du catalogue de démonstration.
 *
 * Le catalogue ne contient **aucun identifiant de compte** : il ne nomme que
 * des rôles symboliques (`developer`, `tester`, `owner`, `agent`). Le rejoueur
 * (`tools/seed-demo-project.mjs`) les résout au moment de jouer, en lisant la
 * distribution réelle du site de démonstration
 * (`~/.atlassian/preuve-demo-cible.json`).
 *
 * Deux raisons de faire ainsi :
 * - le dépôt reste public : aucun identifiant Atlassian n'y entre ;
 * - la garde des tests (`tests/tools/demo-scenarios.test.ts`) tourne hors
 *   réseau et hors machine de démonstration : elle vérifie des rôles, pas des
 *   comptes qui n'existent que sur un site.
 *
 * Sur le site de démonstration, les trois personnes sont `Administrators` :
 * - `developer` : l'assigné du ticket (Baptiste Faisy) — il ne peut pas
 *   attester son propre travail (SPEC §9.4) ;
 * - `tester` : la testeuse (Alison Swift) — elle atteste ;
 * - `owner` : le product owner (John Doe) — il déroge ;
 * - `agent` : le compte de l'app — il ne déclare que (SPEC §19).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** Les quatre rôles symboliques : ce sont aussi les clés de la cible. */
export const ACTOR_KEYS = Object.freeze(['developer', 'tester', 'owner', 'agent']);

/** La distribution par défaut : les mêmes quatre personnes sur chaque ticket. */
export const DEMO_CAST = Object.freeze({
  developer: 'developer',
  tester: 'tester',
  owner: 'owner',
  agent: 'agent',
});
