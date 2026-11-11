/**
 * Souche — déclencheur sur modification de ticket (SPEC §17)
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";

/** Événement `avi:jira:updated:issue` : critères modifiés dans la description. */
export async function onJiraEvent(_payload: Record<string, unknown>, _deps: AppDeps): Promise<void> {
  // Souche : le lot L4 relaie vers L1 (import) et L3 (recalcul de couverture).
}
