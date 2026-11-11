/**
 * Souche — consommateur de la file CI (SPEC §17)
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md). Le socle pose la signature
 * exportée, qui est gelée : le lot remplace le corps sans la changer.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from "../deps.js";
import type { CiIngestMessage } from "../ports.js";

/** Traite un résumé de CI : preuves de test, fraîcheur, couverture, preuve vivante. */
export async function onCiMessage(_message: CiIngestMessage, _deps: AppDeps): Promise<void> {
  // Souche : le lot L4 implémente les quatre étapes du SPEC §17.
}
