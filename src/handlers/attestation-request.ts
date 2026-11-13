/**
 * Helper d'orchestration : demande d'attestation à un tiers (SPEC §9.4,
 * §14 FP-15, §15 `request-attestation`).
 *
 * Invariants :
 * 1. La demande est adressée au **rôle compétent** : le rôle exigé par la
 *    grille du projet pour le type du critère (sécurité, données), sinon un
 *    rôle autorisé à attester (SPEC §9.2, §9.4).
 * 2. **Jamais à l'assigné** du ticket : celui qui fait n'atteste pas
 *    (SPEC §5 principe 3, FP-08).
 * 3. La demande **n'atteste rien** : aucune ligne `attestation` n'est écrite,
 *    aucune force de preuve ne change — seule une notification part.
 * 4. Un agent peut *demander* une attestation (SPEC §7.1, étape 4) ; il ne
 *    peut pas en être la cible utile, car un agent ne peut jamais attester.
 *
 * Ce fichier est un helper appelé par les écrans (L6) et les actions MCP (L5),
 * pas un module du manifest (le manifest est gelé).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type { Actor, Criterion, IssueRef, Language, ProjectSettings } from '../types';
import { text } from '../i18n/index';
import { REPORT_MESSAGES } from '../i18n/reports';

export interface AttestationRequest {
  issueKey: string;
  criterionCode: string;
  targetAccountId: string;
  /** Ce que la personne doit vérifier (SPEC §15, `what`). */
  what: string;
  requester: Actor;
}

export interface AttestationRequestResult {
  ok: boolean;
  notified: boolean;
  /** Message traduit expliquant le refus ; vide quand la demande passe. */
  errorMessage: string;
  criterion: Criterion | null;
}

function failure(key: string, language: Language, vars: Record<string, string> = {}): AttestationRequestResult {
  return {
    ok: false,
    notified: false,
    errorMessage: text(REPORT_MESSAGES, key, language, vars),
    criterion: null,
  };
}

/** Vrai si la cible porte le rôle compétent pour ce critère (SPEC §9.4). */
function hasCompetentRole(
  settings: ProjectSettings | null,
  criterion: Criterion,
  targetRoles: readonly string[],
): boolean {
  if (settings === null) return targetRoles.length > 0;
  const required = settings.requirements[criterion.type].attesterRole;
  if (required !== '') return targetRoles.includes(required);
  return settings.roles.attest.some((role) => targetRoles.includes(role));
}

async function notifyTarget(
  deps: AppDeps,
  issue: IssueRef,
  criterion: Criterion,
  request: AttestationRequest,
  language: Language,
): Promise<boolean> {
  const subject = text(REPORT_MESSAGES, 'attestation.request.subject', language, {
    issueKey: issue.key,
  });
  const what = request.what.trim();
  const body = text(REPORT_MESSAGES, 'attestation.request.body', language, {
    code: criterion.code,
    issueKey: issue.key,
    text: what.length > 0 ? `${criterion.text} — ${what}` : criterion.text,
  });
  return deps.jira.notify(request.targetAccountId, subject, body, issue.key);
}

/**
 * Traite une demande d'attestation : vérifie l'indépendance de la cible et son
 * rôle, puis notifie. N'écrit aucune attestation (SPEC §14 FP-15).
 */
export async function requestAttestation(
  deps: AppDeps,
  request: AttestationRequest,
  fallbackLanguage: Language = 'en',
): Promise<AttestationRequestResult> {
  const issue = await deps.jira.getIssue(request.issueKey);
  if (issue === null) {
    return failure('attestation.request.error.issueNotFound', fallbackLanguage, {
      issueKey: request.issueKey,
    });
  }
  const settings = await deps.store.getSettings(issue.projectId);
  const language = settings?.language ?? fallbackLanguage;

  if (issue.assigneeAccountId !== '' && issue.assigneeAccountId === request.targetAccountId) {
    return failure('attestation.request.error.assignee', language);
  }

  const criterion = await deps.store.getCriterionByCode(issue.id, request.criterionCode);
  if (criterion === null) {
    return failure('attestation.request.error.criterionNotFound', language, {
      code: request.criterionCode,
      issueKey: issue.key,
    });
  }

  const targetRoles = await deps.jira.projectRoles(issue.projectId, request.targetAccountId);
  if (!hasCompetentRole(settings, criterion, targetRoles)) {
    return failure('attestation.request.error.role', language, { code: criterion.code });
  }

  const notified = await notifyTarget(deps, issue, criterion, request, language);
  deps.logger.log('info', `attestation demandée : ${issue.key} ${criterion.code}`, {
    target: request.targetAccountId,
    requester: request.requester.accountId,
    requesterIsAgent: request.requester.agent,
    notified,
  });
  return { ok: true, notified, errorMessage: '', criterion };
}
