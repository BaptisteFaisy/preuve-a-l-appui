/**
 * Souche — moteur de couverture (SPEC §12.3).
 *
 * Propriétaire : lot L3 (docs/CONTRACTS.md §2). Tous les autres lots
 * appellent `deps.coverage.recompute(issueId)` : le validateur, le
 * consommateur de CI et l'outil `get-proof-status` lisent ainsi **la même
 * ligne**, jamais deux calculs qui divergent (SPEC §22, point 10).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, CoverageEngine, Logger, ProofStore } from '../ports.js';
import { stubOf } from '../db/stub.js';

/** Ce dont le moteur a besoin : la persistance, l'horloge, le journal. */
export interface CoverageEngineDeps {
  store: ProofStore;
  clock: Clock;
  logger: Logger;
}

/** Le moteur réel est écrit par le lot L3 ; la signature, elle, est gelée. */
export function createCoverageEngine(_deps: CoverageEngineDeps): CoverageEngine {
  return stubOf<CoverageEngine>('createCoverageEngine', 'L3');
}
