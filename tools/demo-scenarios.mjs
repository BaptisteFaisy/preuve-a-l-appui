/**
 * Le catalogue de démonstration — point d'entrée public.
 *
 * Le catalogue lui-même est découpé dans `tools/demo-scenarios/` (un fichier
 * par ticket, plus la distribution des rôles) : c'est la **seule** source des
 * histoires de tickets. Ce fichier n'est qu'une porte d'entrée : il ne
 * contient aucune donnée.
 *
 * Usage :
 *   import { DEMO_SCENARIOS } from './tools/demo-scenarios.mjs';
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
export { DEMO_SCENARIOS, default } from './demo-scenarios/index.mjs';
export { ACTOR_KEYS, DEMO_CAST } from './demo-scenarios/cast.mjs';
