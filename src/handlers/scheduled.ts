/**
 * Contrôle nocturne des clôtures hors validateur (SPEC §13, §20).
 *
 * Étancheité annoncée (SPEC §20) : l'app dit ce qu'elle bloque et ce qu'elle
 * ne bloque pas. Les clôtures faites hors validateur (transitions en masse,
 * automatisation ou API — SPEC §19) sont relevées chaque nuit, comptées et
 * signalées au responsable du projet.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { Language, ProjectSettings } from '../types.js';
import { text } from '../i18n/index.js';
import { GATE_MESSAGES } from '../i18n/gate.js';

/** Plafond de tickets traités en un tick pour rester sous les quotas Forge. */
export const NIGHTLY_MAX_ISSUES = 200;

export interface ScheduledPayload {
  projectId?: string;
  projectKey?: string;
  limit?: number;
}

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
  await alertOnMissed(deps, project, missed, language, settings);
}

function resolveProjectTarget(payload: Record<string, unknown>): string | null {
  const explicit = payload['projectId'] ?? payload['projectKey'];
  if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit.trim();
  return null;
}

/** Signale les tickets clos sans couverture au journal et par notification. */
async function alertOnMissed(
  deps: AppDeps,
  project: string,
  missed: readonly string[],
  language: Language,
  settings: ProjectSettings | null,
): Promise<void> {
  const summary = text(GATE_MESSAGES, 'scheduled.summary', language, {
    count: missed.length,
    projectKey: project,
  });
  deps.logger.log('warn', summary, { project, missedCount: missed.length });

  // Notifie le premier rôle habilité à déroger si configuré (SPEC §9.4, §14 FP-15)
  const recipient = settings?.roles.waive[0];
  if (!recipient) return;
  for (const issueKey of missed.slice(0, 5)) {
    await deps.jira.notify(
      recipient,
      'scheduled.leak.subject',
      'scheduled.leak.body',
      issueKey,
    );
  }
}
