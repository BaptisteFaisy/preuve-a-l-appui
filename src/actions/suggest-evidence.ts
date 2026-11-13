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
import type { AppDeps } from '../deps';
import type { ActorContext } from '../ports';
import type { SuggestedPair } from '../ports';
import { actionText, loadIssue, requireText, resolveLanguage, splitCsv } from './common';
import { deterministicPairs } from '../domain/matching';
import { ActionError, type SuggestEvidenceResult } from './types';

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
  const lang = await resolveLanguage(deps, issue.projectId);
  let pairs: readonly SuggestedPair[] = [];
  if (criteria.length > 0) {
    try {
      pairs = await deps.llm.suggestPairs(criteria, testNames);
    } catch {
      pairs = [];
    }
    // Le repli déterministe (SPEC §19) : quand le modèle ne propose rien,
    // l'app sait quand même rapprocher un test d'un critère par les mots
    // partagés.
    if (pairs.length === 0) {
      pairs = deterministicPairs(criteria, testNames, lang);
    }
  }
  const suggestions = pairs.map((pair) => ({
    criterionId: pair.criterionId,
    testName: pair.testName,
    confidence: pair.confidence,
    rationale: pair.rationale,
  }));
  return { issueKey, suggestions, text: buildText(issueKey, pairs, lang) };
}
