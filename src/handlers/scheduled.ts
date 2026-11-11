/**
 * Souche — contrôle nocturne des clôtures (SPEC §20)
 *
 * Propriétaire : lot L3 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";

/** Liste chaque nuit les tickets passés à « Terminé » hors validateur. */
export async function onScheduledTick(
  _payload: Record<string, unknown>,
  _deps: AppDeps,
): Promise<void> {
  // Souche : le lot L3 implémente l’étanchéité annoncée.
}
