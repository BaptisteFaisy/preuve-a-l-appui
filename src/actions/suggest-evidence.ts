/**
 * Outil `suggest-evidence` (SPEC §15, verbe GET).
 *
 * Propose des paires test ↔ critère avec confiance et justification, via le
 * modèle de langue (SPEC §11, FP-14). Une paire suggérée ne compte JAMAIS
 * comme preuve : la confirmation est un geste humain, et cet outil n'écrit
 * aucune ligne `test_link` — il ne fait que suggérer.
 *
 * Entrée `testNames` : chaîne séparée par des virgules, découpée ici (SPEC §19).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';
import type { SuggestedPair } from '../ports.js';
import { actionText, loadIssue, requireText, resolveLanguage, splitCsv } from './common.js';
import { ActionError, type SuggestEvidenceResult } from './types.js';

function formatPairs(pairs: readonly SuggestedPair[]): string {
  return pairs
    .map((pair) => `  * ${pair.testName} → ${pair.criterionId} (confidence ${Math.round(pair.confidence * 100)}%) : ${pair.rationale}`)
    .join('\n');
}

function buildText(
  issueKey: string,
  pairs: readonly SuggestedPair[],
  lang: 'en' | 'fr',
): string {
  if (pairs.length === 0) return actionText('suggest.none', lang, { issueKey });
  const head = actionText('suggest.success', lang, { count: pairs.length, issueKey });
  return `${head}\n${formatPairs(pairs)}`;
}

export async function suggestEvidence(
  payload: Record<string, unknown>,
  deps: AppDeps,
  _context: ActorContext,
): Promise<SuggestEvidenceResult> {
  const issueKey = requireText(payload['issueKey'], 'issueKey');
  const issue = await loadIssue(deps, issueKey);

  const testNames = splitCsv(payload['testNames']);
  if (testNames.length === 0) {
    throw new ActionError(actionText('err.suggest.emptyTests', 'en'), 'empty-test-names');
  }

  // Seuls les critères actifs sont rapprochables (SPEC §8.3).
  const criteria = await deps.store.listCriteriaByIssue(issue.id, ['active']);
  let pairs: readonly SuggestedPair[] = [];
  if (criteria.length > 0) {
    try {
      pairs = await deps.llm.suggestPairs(criteria, testNames);
    } catch {
      pairs = [];
    }
  }

  const lang = await resolveLanguage(deps, issue.projectId);
  const suggestions = pairs.map((pair) => ({
    criterionId: pair.criterionId,
    testName: pair.testName,
    confidence: pair.confidence,
    rationale: pair.rationale,
  }));
  return { issueKey, suggestions, text: buildText(issueKey, pairs, lang) };
}
