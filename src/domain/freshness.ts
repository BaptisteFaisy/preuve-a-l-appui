/**
 * Fraîcheur des preuves de type test à l'arrivée d'un résumé de CI (SPEC §9.3, §10, §21).
 *
 * Domaine pur : aucun import `@forge/*`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { IdGenerator } from '../ports';
import type { CiSummary, Evidence, TestOutcome, TestState } from '../types';

/** Extrait la clé de ticket Jira d'un nom de branche (`feature/PAY-123-limit` → `PAY-123`). */
export function extractIssueKeyFromBranch(branch: string): string | null {
  const match = /(?:^|[^A-Z0-9])([A-Z][A-Z0-9_]*-\d+)(?=$|[^0-9])/i.exec(branch);
  return match?.[1] ? match[1].toUpperCase() : null;
}

/** Résultat pur de l'application d'un résumé de CI sur des preuves existantes. */
export interface FreshnessUpdate {
  /** Preuves à persister (anciennes marquées `stale` + nouvelles, ou passées à `to-reconfirm`). */
  readonly toSave: readonly Evidence[];
  readonly updatedCount: number;
  readonly reconfirmCount: number;
}

function outcomeMapOf(outcomes: readonly TestOutcome[]): Map<string, TestOutcome> {
  const map = new Map<string, TestOutcome>();
  for (const outcome of outcomes) {
    map.set(outcome.name, outcome);
  }
  return map;
}

function nextEvidenceState(state: TestState): Pick<Evidence, 'strength' | 'verified' | 'freshness'> {
  if (state === 'passed') {
    return { strength: 'machine-verified', verified: true, freshness: 'fresh' };
  }
  return { strength: 'declared', verified: false, freshness: 'fresh' };
}

function isSameState(
  existing: Evidence,
  next: Pick<Evidence, 'strength' | 'verified' | 'freshness'>,
  commit: string,
): boolean {
  return (
    existing.commit === commit &&
    existing.strength === next.strength &&
    existing.verified === next.verified &&
    existing.freshness === next.freshness
  );
}

function replaceEvidence(
  existing: Evidence,
  outcome: TestOutcome,
  commit: string,
  now: string,
  ids: IdGenerator,
): readonly [Evidence, Evidence] {
  const nextState = nextEvidenceState(outcome.state);
  const replacementId = ids.next('ev');
  const archived: Evidence = {
    ...existing,
    freshness: 'stale',
    replacedBy: replacementId,
  };
  const fresh: Evidence = {
    ...existing,
    id: replacementId,
    ...nextState,
    commit,
    at: now,
    replacedBy: '',
  };
  return [archived, fresh];
}

/**
 * Met à jour les preuves de type `test` selon un résumé de CI :
 * - test présent et `passed` → remplacée par une preuve fraîche `machine-verified` ;
 * - test présent et `failed` / `skipped` / `absent` → remplacée par non valable (`declared`, `verified: false`) ;
 * - test absent du résumé sur un nouveau commit → `to-reconfirm` (SPEC §9.3) ;
 * - test absent du résumé sur le même commit → intacte (SPEC §21 : pipeline rouge ailleurs).
 */
export function applyCiSummaryToEvidences(
  evidences: readonly Evidence[],
  summary: CiSummary,
  ids: IdGenerator,
  now: string,
): FreshnessUpdate {
  const byName = outcomeMapOf(summary.tests);
  const toSave: Evidence[] = [];
  let updatedCount = 0;
  let reconfirmCount = 0;

  for (const ev of evidences) {
    if (ev.type !== 'test' || ev.replacedBy !== '') continue;
    const outcome = byName.get(ev.reference);
    if (outcome !== undefined) {
      const next = nextEvidenceState(outcome.state);
      if (isSameState(ev, next, summary.commit)) continue;
      const [archived, replacement] = replaceEvidence(ev, outcome, summary.commit, now, ids);
      toSave.push(archived, replacement);
      updatedCount += 1;
    } else if (ev.commit !== '' && ev.commit !== summary.commit && ev.freshness === 'fresh') {
      toSave.push({ ...ev, freshness: 'to-reconfirm' });
      reconfirmCount += 1;
    }
  }

  return { toSave, updatedCount, reconfirmCount };
}
