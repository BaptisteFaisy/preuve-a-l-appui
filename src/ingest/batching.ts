/**
 * Découpage et réassemblage des résumés de CI en lots (SPEC §10 : au-delà de
 * 5 Mo, envoi en plusieurs lots).
 *
 * Le découpage sert à l'émetteur (la commande d'une ligne dans le pipeline) ;
 * le réassemblage sert au web trigger, qui remet le résumé complet en file une
 * fois le dernier lot reçu. Horloge injectable : aucun `Date.now()` en dur.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { CiBatch, CiSummary, TestOutcome } from '../types.js';

/** Seuil de découpage : 4 Mo, sous la limite Forge de 5 Mo (SPEC §19). */
export const BATCH_BYTE_LIMIT = 4 * 1024 * 1024;

/** Durée de vie d'un assemblage entamé avant purge : 5 minutes. */
export const ASSEMBLY_TTL_MS = 300_000;

/** Taille estimée d'un résultat de test une fois sérialisé (nom + état). */
function estimateOutcomeBytes(outcome: TestOutcome): number {
  return Buffer.byteLength(outcome.name, 'utf8') + 64;
}

/** Taille du socle commun d'un lot (repo, branche, commit, structure JSON). */
function baseSummaryBytes(summary: CiSummary): number {
  return (
    Buffer.byteLength(summary.repo, 'utf8') +
    Buffer.byteLength(summary.branch, 'utf8') +
    Buffer.byteLength(summary.commit, 'utf8') +
    256
  );
}

/**
 * Découpe un résumé en lots dont la taille sérialisée reste sous `byteLimit`.
 * Un résumé qui tient produit exactement un lot (`total: 1`).
 */
export function splitCiSummaryIntoBatches(
  runId: string,
  summary: CiSummary,
  byteLimit = BATCH_BYTE_LIMIT,
): CiBatch[] {
  if (summary.tests.length === 0) {
    return [{ runId, index: 0, total: 1, summary }];
  }

  const overhead = baseSummaryBytes(summary);
  const chunks: TestOutcome[][] = [];
  let current: TestOutcome[] = [];
  let bytes = overhead;

  for (const test of summary.tests) {
    const size = estimateOutcomeBytes(test);
    if (current.length > 0 && bytes + size > byteLimit) {
      chunks.push(current);
      current = [];
      bytes = overhead;
    }
    current.push(test);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);

  const total = chunks.length;
  return chunks.map((tests, index) => ({
    runId,
    index,
    total,
    summary: { ...summary, tests },
  }));
}

/** État d'un assemblage en cours, pour un `runId`. */
interface AssemblyState {
  readonly total: number;
  readonly batches: Map<number, CiBatch>;
  readonly createdAt: number;
}

/** Fusionne tous les lots d'un assemblage complet en un seul résumé. */
function assembleBatches(state: AssemblyState): CiSummary {
  const ordered: CiBatch[] = [];
  for (let i = 0; i < state.total; i += 1) {
    const batch = state.batches.get(i);
    if (batch !== undefined) ordered.push(batch);
  }
  const base = ordered[0].summary;
  const tests: TestOutcome[] = [];
  for (const batch of ordered) tests.push(...batch.summary.tests);
  return { ...base, tests };
}

/**
 * Registre en mémoire des lots reçus. Un lot manquant n'est jamais deviné :
 * le résumé complet n'est rendu que lorsque les `total` lots sont arrivés.
 */
export class BatchReassembler {
  private readonly assemblies = new Map<string, AssemblyState>();

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  /**
   * Ajoute un lot. Retourne le résumé fusionné quand le run est complet,
   * `null` tant qu'il manque des lots. Un lot seul (`total: 1`) passe droit.
   */
  addBatch(batch: CiBatch): CiSummary | null {
    if (batch.total <= 1) return batch.summary;

    let state = this.assemblies.get(batch.runId);
    if (state === undefined || state.total !== batch.total) {
      state = { total: batch.total, batches: new Map(), createdAt: this.nowMs() };
      this.assemblies.set(batch.runId, state);
    }
    state.batches.set(batch.index, batch);

    if (state.batches.size < state.total) return null;
    const merged = assembleBatches(state);
    this.assemblies.delete(batch.runId);
    return merged;
  }

  /** Oublie les assemblages entamés depuis plus de `ttlMs` (jamais complétés). */
  prune(ttlMs = ASSEMBLY_TTL_MS): void {
    const now = this.nowMs();
    for (const [runId, state] of this.assemblies) {
      if (now - state.createdAt > ttlMs) this.assemblies.delete(runId);
    }
  }

  /** Nombre d'assemblages en cours (observable par les tests). */
  get pending(): number {
    return this.assemblies.size;
  }
}
