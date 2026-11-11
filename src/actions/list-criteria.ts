/**
 * Outil `list-criteria` (SPEC §15, verbe GET).
 *
 * Liste les critères d'acceptation d'un ticket : code stable, type, force
 * exigée, statut et version (SPEC §8.1). Lecture seule — l'outil ne modifie
 * jamais la grille d'exigences ni les critères.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';
import type { Criterion } from '../types.js';
import { actionText, loadIssue, requireText, resolveLanguage } from './common.js';
import type { CriterionSummary, ListCriteriaResult } from './types.js';

function toSummary(criterion: Criterion): CriterionSummary {
  return {
    id: criterion.id,
    code: criterion.code,
    text: criterion.text,
    type: criterion.type,
    requiredStrength: criterion.requiredStrength,
    status: criterion.status,
    version: criterion.version,
  };
}

/** Texte utile à un agent : une ligne par critère, force exigée incluse. */
function formatList(issueKey: string, criteria: readonly CriterionSummary[], lang: 'en' | 'fr'): string {
  if (criteria.length === 0) return actionText('list.none', lang, { issueKey });
  const lines = criteria.map(
    (c) => `- ${c.code} [${c.status}] (${c.type}, v${c.version}) — ${c.text} — required: ${c.requiredStrength}`,
  );
  const head = actionText('list.summary', lang, { issueKey, total: criteria.length });
  return `${head}\n${lines.join('\n')}`;
}

export async function listCriteria(
  payload: Record<string, unknown>,
  deps: AppDeps,
  _context: ActorContext,
): Promise<ListCriteriaResult> {
  const issueKey = requireText(payload['issueKey'], 'issueKey');
  const issue = await loadIssue(deps, issueKey);
  const lang = await resolveLanguage(deps, issue.projectId);

  const criteria = (await deps.store.listCriteriaByIssue(issue.id)).map(toSummary);
  return { issueKey, total: criteria.length, criteria, text: formatList(issueKey, criteria, lang) };
}
