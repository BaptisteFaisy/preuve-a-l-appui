/**
 * Souche — actions Rovo et outils MCP (SPEC §15)
 *
 * Propriétaire : lot L5 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";
import type { ActorContext } from "../ports.js";

/** Les sept outils du SPEC §15, dans l’ordre du tableau. */
export const ACTION_KEYS = [
  "list-criteria",
  "get-proof-status",
  "attach-evidence",
  "propose-criteria",
  "request-attestation",
  "suggest-evidence",
  "get-release-proof",
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

/** Erreur métier d’une action : message lisible par l’agent qui appelle. */
export class ActionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ActionError";
  }
}

/** Exécute un outil. Aucun ne permet d’attester, de déroger ni de valider. */
export async function runAction(
  name: string,
  _payload: Record<string, unknown>,
  _deps: AppDeps,
  _context: ActorContext,
): Promise<unknown> {
  // Souche : le lot L5 câble chaque clé sur son implémentation.
  throw new ActionError(`action non implémentée : ${name} (lot L5)`, "not-implemented");
}
