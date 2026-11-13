/**
 * Contrôle nocturne des clôtures hors validateur (SPEC §13, §20).
 *
 * Étanchéité annoncée (SPEC §20) : l'app dit ce qu'elle bloque et ce qu'elle
 * ne bloque pas. Les clôtures faites hors validateur (transitions en masse,
 * automatisation ou API — SPEC §19) sont relevées chaque nuit, comptées et
 * signalées.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type { Language, Waiver } from '../types';
import { text } from '../i18n/index';
import { GATE_MESSAGES } from '../i18n/gate';

/** Plafond de tickets traités en un tick pour rester sous les quotas Forge. */
export const NIGHTLY_MAX_ISSUES = 200;

/** Plafond de notifications envoyées en un tick pour ménager l'API Jira. */
export const MAX_ALERTS_PER_RUN = 25;

/** L'époque de référence des lectures « tout l'historique » (SPEC §20). */
export const EPOCH = '1970-01-01 00:00:00';

/** Liste chaque nuit les tickets passés à « Terminé » hors validateur. */
export async function onScheduledTick(
  payload: Record<string, unknown>,
  deps: AppDeps,
): Promise<void> {
  const project = resolveProjectTarget(payload);
  if (!project) {
    deps.logger.log('info', text(GATE_MESSAGES, 'scheduled.noProject', 'en'));
    return;
  }
  const settings = await deps.store.getSettings(project);
  const language: Language = settings?.language ?? 'en';
  const limit = Math.min(Number(payload['limit']) || NIGHTLY_MAX_ISSUES, NIGHTLY_MAX_ISSUES);

  // D'abord les dérogations qui ont expiré : une dérogation dont l'échéance
  // est passée n'est plus une dérogation (SPEC §12.4). Le critère redevient
  // un critère sans preuve, et le ticket peut repasser « bloqué ».
  await expireWaivers(deps, project, language, limit);

  const missed = await deps.store.listClosedWithoutCoverage(project, limit);

  if (missed.length === 0) return;
  await alertOnMissed(deps, project, missed, language);
}

/** Les dérogations du projet dont l'échéance est passée (SPEC §12.4). */
async function expiredWaivers(
  deps: AppDeps,
  projectKey: string,
  now: string,
): Promise<Waiver[]> {
  const waivers = await deps.store.listWaiversByProject(projectKey, EPOCH);
  return waivers.filter(
    (waiver) =>
      waiver.revokedAt === '' && waiver.expiresAt !== '' && waiver.expiresAt <= now,
  );
}

/** Le ticket concerné par une dérogation : le critère, puis son ticket. */
async function issueOfWaiver(deps: AppDeps, waiver: Waiver): Promise<string | null> {
  const criterion = await deps.store.getCriterion(waiver.criterionId);
  return criterion === null ? null : criterion.issueId;
}

/**
 * Fait expirer les dérogations : la couverture des tickets concernés est
 * recalculée, et ce qui change est signalé. Un tick qui ne trouve rien à
 * changer ne signale rien — le contrôle est idempotent.
 */
async function expireWaivers(
  deps: AppDeps,
  project: string,
  language: Language,
  limit: number,
): Promise<number> {
  const projectKey = await deps.jira.projectKey(project);
  if (projectKey === '') return 0;
  const now = deps.clock.now();
  const expired = await expiredWaivers(deps, projectKey, now);
  if (expired.length === 0) return 0;

  const notified = new Set<string>();
  let changed = 0;
  for (const waiver of expired.slice(0, limit)) {
    const issueId = await issueOfWaiver(deps, waiver);
    if (issueId === null) continue;
    const before = await deps.store.getCoverage(issueId);
    await deps.coverage.recompute(issueId);
    const after = await deps.store.getCoverage(issueId);
    if (before === null || after === null) continue;
    if (before.passes === after.passes && before.waived === after.waived) continue;
    changed += 1;
    if (notified.has(issueId)) continue;
    notified.add(issueId);
    await alertExpiredWaiver(deps, issueId, waiver, language);
  }
  deps.logger.log('info', text(GATE_MESSAGES, 'scheduled.waiver.expired.summary', language, {
    count: changed,
    projectKey,
  }), { project, projectKey, changed });
  return changed;
}

/** Signale qu'une dérogation a expiré et que le ticket a besoin d'une preuve. */
async function alertExpiredWaiver(
  deps: AppDeps,
  issueId: string,
  waiver: Waiver,
  language: Language,
): Promise<void> {
  const issue = await deps.jira.getIssue(issueId);
  if (issue === null) return;
  const recipient = issue.reporterAccountId || issue.assigneeAccountId;
  if (recipient === '') return;
  const criterion = await deps.store.getCriterion(waiver.criterionId);
  const body = text(GATE_MESSAGES, 'scheduled.waiver.expired.body', language, {
    code: criterion?.code ?? '',
    date: waiver.expiresAt.slice(0, 10),
  });
  await deps.jira.notify(
    recipient,
    'scheduled.waiver.expired.subject',
    body,
    issue.key,
    language,
  );
}

function resolveProjectTarget(payload: Record<string, unknown>): string | null {
  const explicit = payload['projectId'] ?? payload['projectKey'];
  if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit.trim();
  return null;
}

/** Signale les tickets clos sans couverture : journal + notification au déclarant/assigné. */
async function alertOnMissed(
  deps: AppDeps,
  project: string,
  missed: readonly string[],
  language: Language,
): Promise<void> {
  const summary = text(GATE_MESSAGES, 'scheduled.summary', language, {
    count: missed.length,
    projectKey: project,
  });
  deps.logger.log('warn', summary, { project, missedCount: missed.length });

  // Chaque ticket clos hors validateur est signalé (SPEC §20) :
  // on notifie le déclarant ou l'assigné via son accountId Jira réel.
  for (const issueId of missed.slice(0, MAX_ALERTS_PER_RUN)) {
    const issue = await deps.jira.getIssue(issueId);
    if (!issue) continue;
    const recipient = issue.reporterAccountId || issue.assigneeAccountId;
    if (!recipient) continue;
    await deps.jira.notify(
      recipient,
      'scheduled.leak.subject',
      'scheduled.leak.body',
      issue.key,
      language,
    );
  }
}
