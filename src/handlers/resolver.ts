/**
 * Souche — résolveur des quatre écrans Forge (SPEC §16)
 *
 * Propriétaire : lot L6 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";

/** Ce que `@forge/resolver` passe au callback : la charge utile et le contexte. */
export interface ResolverRequest {
  payload: Record<string, unknown>;
  context: unknown;
}

/** Ce que `@forge/resolver` expose : une définition par clé de module. */
export interface ResolverLike {
  define(key: string, fn: (request: ResolverRequest) => Promise<unknown>): void;
}

/** Enregistre les définitions des écrans : matrice, champ, réglages, page projet. */
export function registerResolvers(_resolver: ResolverLike, _deps: AppDeps): void {
  // Souche : aucune définition. Le lot L6 enregistre ici les clés des modules
  // jira:issuePanel, jira:customField, jira:projectSettingsPage, jira:projectPage.
}
