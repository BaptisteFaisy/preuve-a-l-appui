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
import type { AppDeps } from '../deps.js';
import type { Language } from '../types.js';
import { text } from '../i18n/index.js';
import { GATE_MESSAGES } from '../i18n/gate.js';

/** Plafond de tickets traités en un tick pour rester sous les quotas Forge. */
export const NIGHTLY_MAX_ISSUES = 200;

/** Plafond de notifications envoyées en un tick pour ménager l'API Jira. */
export const MAX_ALERTS_PER_RUN = 25;

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
  const missed = await deps.store.listClosedWithoutCoverage(project, limit);

  if (missed.length === 0) return;
  await alertOnMissed(deps, project, missed, language);
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
    );
  }
}
