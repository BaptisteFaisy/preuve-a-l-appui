/**
 * Souche — validateur de workflow (SPEC §12.1)
 *
 * Propriétaire : lot L3 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";
import type { GateVerdict } from "../types.js";

/** Charge utile du validateur : clé, configuration, statuts (SPEC §19). */
export interface ValidatorInput {
  issueKey: string;
  configuration: Record<string, unknown>;
  transition: { fromStatus: string; toStatus: string };
}

export type Validator = (input: ValidatorInput) => Promise<GateVerdict>;

/** Construit le validateur : il lit la couverture, il ne calcule rien (SPEC §17). */
export function createValidator(_deps: AppDeps): Validator {
  return async (_input: ValidatorInput): Promise<GateVerdict> => {
    // Souche : laisse passer. Le lot L3 lit `coverage` et compose le message.
    return { result: true, errorMessage: "" };
  };
}
