/**
 * Souche — point d’entrée des résultats de CI (SPEC §10)
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";

/** Requête du web trigger : le corps reste brut, la signature en dépend. */
export interface CiWebRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  query: Record<string, string>;
}

/** Réponse du web trigger (module `response: { type: dynamic }`). */
export interface CiWebResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Vérifie la signature, range le résumé dans la file, répond aussitôt. */
export async function handleCiResults(
  _request: CiWebRequest,
  _deps: AppDeps,
): Promise<CiWebResponse> {
  // Souche : le lot L4 vérifie la signature, découpe les lots, publie sur la file.
  return {
    statusCode: 501,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "not-implemented", lot: "L4" }),
  };
}
