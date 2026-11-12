/**
 * Outil `attach-evidence` (SPEC §15, verbe CREATE).
 *
 * Enregistre une preuve **déclarée** sur un critère. Points de contrat :
 * - tout appel dont `context.fromMcp` est vrai (ou tout acteur agent) marque
 *   la preuve `addedByAgent: true` (SPEC §19 : identité incertaine → agent) ;
 * - la force calculée reste `declared` : la force est calculée par l'app à
 *   partir de SES vérifications (CI, attestation humaine — SPEC §9.1),
 *   jamais par la déclaration de l'appelant. Un outil ne peut pas attester ;
 * - la couverture est recalculée par le moteur L3, jamais ici (§1bis).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type { ActorContext } from '../ports';
import { EVIDENCE_TYPES, type Evidence, type EvidenceType } from '../types';
import { actionText, loadIssue, requireText, resolveCriterion, resolveLanguage } from './common';
import { ActionError, type AttachEvidenceResult } from './types';

/** Type de preuve validé contre les six types du SPEC §9.1. */
function parseEvidenceType(raw: unknown): EvidenceType {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!(EVIDENCE_TYPES as readonly string[]).includes(value)) {
    throw new ActionError(
      actionText('err.evidence.invalidType', 'en', { type: String(raw ?? '') }),
      'invalid-evidence-type',
    );
  }
  return value as EvidenceType;
}

/** Vrai si l'appel vient de MCP ou d'un acteur agent (SPEC §19). */
export function isAgentCall(context: ActorContext, agentFlag: boolean): boolean {
  return context.fromMcp === true || agentFlag;
}

export async function attachEvidence(
  payload: Record<string, unknown>,
  deps: AppDeps,
  context: ActorContext,
): Promise<AttachEvidenceResult> {
  const issueKey = requireText(payload['issueKey'], 'issueKey');
  const criterionRef = requireText(payload['criterionId'], 'criterionId');
  const type = parseEvidenceType(payload['type']);
  const reference = requireText(payload['reference'], 'reference');
  const note = typeof payload['note'] === 'string' ? payload['note'].trim() : '';

  const issue = await loadIssue(deps, issueKey);
  const criterion = await resolveCriterion(deps, issue, criterionRef);
  const actor = await deps.identity.actorOf(context);
  const byAgent = isAgentCall(context, actor.agent);
  // SPEC §22 point 11 : un agent ne peut pas attester — même en le déclarant.
  if (byAgent && type === 'attestation') {
    throw new ActionError(actionText('err.forbidden.action', 'en'), 'forbidden-action');
  }

  const evidence: Evidence = {
    id: deps.ids.next('ev'),
    criterionId: criterion.id,
    criterionVersion: criterion.version,
    type,
    reference,
    note,
    // Déclaration seule : la force monte via la vérification de l'app (§9.1).
    strength: 'declared',
    commit: '',
    freshness: 'fresh',
    verified: false,
    addedBy: actor.accountId,
    addedByAgent: byAgent,
    at: deps.clock.now(),
    replacedBy: '',
  };
  await deps.store.saveEvidence(evidence);
  await deps.coverage.recompute(issue.id);

  const lang = await resolveLanguage(deps, issue.projectId);
  const vars = { evidenceId: evidence.id, criterionId: criterion.code, strength: evidence.strength };
  return {
    evidenceId: evidence.id,
    criterionId: criterion.id,
    criterionCode: criterion.code,
    type,
    strength: evidence.strength,
    addedByAgent: byAgent,
    text: actionText(byAgent ? 'attach.agent.success' : 'attach.success', lang, vars),
  };
}
