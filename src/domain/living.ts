/**
 * Preuve vivante des critères livrés sur la branche principale (SPEC §7.5, §13).
 *
 * Domaine pur : aucun import `@forge/*`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { IdGenerator } from '../ports';
import type { LivingProof, LivingState, TestOutcome, TestState } from '../types';

/** Une preuve vivante existante ou un lien confirmé suivi sur la branche principale. */
export interface TrackedLivingItem {
  readonly existing?: LivingProof;
  readonly issueKey: string;
  readonly criterionId: string;
  readonly testName: string;
  readonly component: string;
}

/** Signalement à émettre sur un ticket dont la preuve vivante s'est dégradée. */
export interface LivingAlert {
  readonly proof: LivingProof;
  readonly previousState: LivingState;
  readonly issueKey: string;
  readonly criterionId: string;
  readonly testName: string;
}

/** Résultat pur d'une passe de preuve vivante sur la branche principale. */
export interface LivingEvaluation {
  readonly updated: readonly LivingProof[];
  readonly alerts: readonly LivingAlert[];
}

/** Traduit l'état d'un test en état de preuve vivante (absent du résumé = `unproven`). */
export function livingStateOfTest(state: TestState | undefined): LivingState {
  if (state === 'passed') return 'proven';
  if (state === 'failed') return 'regressed';
  return 'unproven';
}

function shouldAlert(previous: LivingState, next: LivingState): boolean {
  if (next === 'proven') return false;
  return previous !== next;
}

function buildNextProof(
  item: TrackedLivingItem,
  nextState: LivingState,
  commit: string,
  now: string,
  ids: IdGenerator,
): LivingProof {
  const existing = item.existing;
  const changed = existing === undefined || existing.state !== nextState;
  return {
    id: existing?.id ?? ids.next('lp'),
    issueKey: item.issueKey,
    criterionId: item.criterionId,
    testName: item.testName,
    state: nextState,
    component: existing?.component || item.component || '',
    commit: changed ? commit : (existing?.commit ?? commit),
    since: changed ? now : (existing?.since ?? now),
  };
}

/**
 * Évalue la preuve vivante de chaque élément suivi à l'arrivée d'un résumé
 * sur la branche principale (`summary.mainBranch === true`).
 *
 * - `passed` → `proven`, aucune alerte ;
 * - `failed` → `regressed`, alerte si transition vers cet état ;
 * - `skipped` ou `absent` (ou absent du run alors qu'il existait) → `unproven`, alerte.
 */
export function evaluateLivingProofs(
  items: readonly TrackedLivingItem[],
  outcomes: readonly TestOutcome[],
  commit: string,
  now: string,
  ids: IdGenerator,
): LivingEvaluation {
  const outcomeByName = new Map<string, TestOutcome>();
  for (const outcome of outcomes) {
    outcomeByName.set(outcome.name, outcome);
  }

  const updated: LivingProof[] = [];
  const alerts: LivingAlert[] = [];

  for (const item of items) {
    const outcome = outcomeByName.get(item.testName);
    const previousState: LivingState = item.existing?.state ?? 'proven';
    const nextState = livingStateOfTest(outcome?.state);
    const nextProof = buildNextProof(item, nextState, commit, now, ids);
    const changed = item.existing === undefined || item.existing.state !== nextState;

    if (changed) {
      updated.push(nextProof);
    }
    if (shouldAlert(previousState, nextState)) {
      alerts.push({
        proof: nextProof,
        previousState,
        issueKey: item.issueKey,
        criterionId: item.criterionId,
        testName: item.testName,
      });
    }
  }

  return { updated, alerts };
}
