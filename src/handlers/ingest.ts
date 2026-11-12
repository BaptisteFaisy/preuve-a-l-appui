/**
 * Point d’entrée des résultats de CI (SPEC §10, FP-06).
 *
 * Propriétaire : lot L4. Signature gelée : remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import { processCiWebRequest } from '../ingest/webtrigger';

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
  request: CiWebRequest,
  deps: AppDeps,
): Promise<CiWebResponse> {
  return processCiWebRequest(request, deps);
}
