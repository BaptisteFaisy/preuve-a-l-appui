/**
 * Outil `propose-criteria` (SPEC §15, verbe CREATE).
 *
 * Enregistre des propositions de critères, au statut `proposed` : elles
 * attendent une validation humaine et ne comptent pas dans la couverture
 * (SPEC §8.3, §15). Aucun outil ne crée de critère `active` — la validation
 * est un geste humain dans l'interface (SPEC §22 point 11).
 *
 * Entrée `criteria` : chaîne séparée par des virgules, découpée ici (SPEC §19).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { defaultStrengthForType } from '../defaults.js';
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';
import type { Criterion, CriterionType } from '../types.js';
import { actionText, loadIssue, requireText, resolveLanguage, splitCsv } from './common.js';
import { ActionError, type ProposedCriterionItem, type ProposeCriteriaResult } from './types.js';

/** Type deviné par le modèle ; une panne du modèle retombe sur `functional`. */
async function classifyOrFallback(deps: AppDeps, text: string): Promise<CriterionType> {
  try {
    return await deps.llm.classifyCriterion(text);
  } catch {
    return 'functional';
  }
}

async function proposeOne(
  deps: AppDeps,
  issueId: string,
  criterionText: string,
  author: string,
): Promise<ProposedCriterionItem> {
  const code = await deps.store.nextCriterionCode(issueId);
  const type = await classifyOrFallback(deps, criterionText);
  const now = deps.clock.now();
  const criterion: Criterion = {
    id: deps.ids.next('crit'),
    issueId,
    code,
    text: criterionText,
    type,
    requiredStrength: defaultStrengthForType(type),
    version: 1,
    // Jamais `active` : la validation est humaine (SPEC §8.3, §15).
    status: 'proposed',
    createdBy: author,
    createdAt: now,
    updatedAt: now,
  };
  await deps.store.saveCriterion(criterion);
  return { id: criterion.id, code: criterion.code, text: criterion.text, status: 'proposed' };
}

export async function proposeCriteria(
  payload: Record<string, unknown>,
  deps: AppDeps,
  context: ActorContext,
): Promise<ProposeCriteriaResult> {
  const issueKey = requireText(payload['issueKey'], 'issueKey');
  const issue = await loadIssue(deps, issueKey);

  const texts = splitCsv(payload['criteria']);
  if (texts.length === 0) {
    throw new ActionError(actionText('err.propose.empty', 'en'), 'empty-criteria');
  }

  const actor = await deps.identity.actorOf(context);
  const criteria: ProposedCriterionItem[] = [];
  for (const criterionText of texts) {
    criteria.push(await proposeOne(deps, issue.id, criterionText, actor.accountId));
  }

  const lang = await resolveLanguage(deps, issue.projectId);
  return {
    issueKey,
    proposedCount: criteria.length,
    criteria,
    text: actionText('propose.success', lang, { count: criteria.length, issueKey }),
  };
}
