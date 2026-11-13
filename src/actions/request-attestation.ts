/**
 * Outil `request-attestation` (SPEC §15, verbe CREATE).
 *
 * Adresse une demande d'attestation au rôle compétent (SPEC §9.2, §9.4) et
 * notifie les destinataires éligibles (FP-15). L'outil **n'atteste rien** :
 * aucune ligne `attestation` n'est écrite ici — le geste reste humain, dans
 * l'interface (SPEC §22 point 11). L'assigné du ticket est toujours exclu :
 * nul ne peut attester son propre travail (SPEC §9.4).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type { ActorContext } from '../ports';
import type { Criterion, IssueRef, ProjectSettings } from '../types';
import { actionText, loadIssue, loadSettings, requireText, resolveCriterion, resolveLanguage } from './common';
import type { RequestAttestationResult } from './types';

/** Rôle compétent pour ce critère : rôle exigé par la grille, sinon le premier rôle qui atteste. */
export function competentRole(settings: ProjectSettings, criterion: Criterion): string {
  const requirement = settings.requirements[criterion.type];
  if (requirement !== undefined && requirement.attesterRole !== '') return requirement.attesterRole;
  return settings.roles.attest[0] ?? '';
}

/** Le compte porte-t-il un rôle qui lui permet d'attester (SPEC §9.4) ? */
function canAttest(settings: ProjectSettings, role: string, held: readonly string[]): boolean {
  if (role !== '' && held.includes(role)) return true;
  return held.some((one) => settings.roles.attest.includes(one));
}

/** Destinataires éligibles : jamais l'assigné (SPEC §9.4). */
async function findRecipients(
  deps: AppDeps,
  settings: ProjectSettings,
  issue: IssueRef,
  role: string,
): Promise<string[]> {
  const candidates = [issue.reporterAccountId].filter(
    (accountId) => accountId !== '' && accountId !== issue.assigneeAccountId,
  );
  const recipients: string[] = [];
  for (const accountId of candidates) {
    const held = await deps.jira.projectRoles(issue.projectId, accountId);
    if (canAttest(settings, role, held)) recipients.push(accountId);
  }
  return recipients;
}

export async function requestAttestation(
  payload: Record<string, unknown>,
  deps: AppDeps,
  _context: ActorContext,
): Promise<RequestAttestationResult> {
  const issueKey = requireText(payload['issueKey'], 'issueKey');
  const criterionRef = requireText(payload['criterionId'], 'criterionId');
  const what = requireText(payload['what'], 'what');

  const issue = await loadIssue(deps, issueKey);
  const criterion = await resolveCriterion(deps, issue, criterionRef);
  const settings = await loadSettings(deps, issue.projectId);

  const role = competentRole(settings, criterion);
  const recipients = await findRecipients(deps, settings, issue, role);
  let notified = false;
  for (const accountId of recipients) {
    const sent = await deps.jira.notify(accountId, 'request.notify.subject', 'request.notify.body', issueKey);
    notified = notified || sent;
  }

  const lang = await resolveLanguage(deps, issue.projectId);
  const vars = { criterionId: criterion.code, issueKey, role, count: recipients.length };
  return {
    issueKey,
    criterionId: criterion.id,
    criterionCode: criterion.code,
    role,
    what,
    recipientCount: recipients.length,
    notified,
    text: actionText(recipients.length > 0 ? 'request.success' : 'request.noRecipient', lang, vars),
  };
}
