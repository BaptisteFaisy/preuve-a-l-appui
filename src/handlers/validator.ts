/**
 * Validateur de workflow (SPEC §12.1, §17).
 *
 * La fonction ne calcule rien : elle lit la ligne de couverture tenue à jour
 * par le moteur (SPEC §17, §22 point 10), compose le message d'erreur au
 * format du SPEC §7.2 et répond vite (SPEC §20 : moins d'une seconde).
 * Elle ne reçoit pas l'identité de celui qui fait la transition (SPEC §12.1) :
 * les dérogations se donnent avant, dans le panneau du ticket.
 *
 * Le doute bloque (SPEC §20) : ticket illisible ou couverture absente →
 * `result: false` avec un message dédié, jamais « tout est prouvé ».
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type { Coverage, GateMode, GateVerdict, IssueRef, Language } from '../types';
import { GATE_MODES } from '../db/mapping-common';
import { evaluateGate } from '../domain/gate';
import { text } from '../i18n/index';
import { GATE_MESSAGES } from '../i18n/gate';

/** Charge utile du validateur : clé, configuration, statuts (SPEC §19). */
export interface ValidatorInput {
  issueKey: string;
  configuration: Record<string, unknown>;
  transition: { fromStatus: string; toStatus: string };
}

export type Validator = (input: ValidatorInput) => Promise<GateVerdict>;

/** Construit le validateur : il lit la couverture, il ne calcule rien (SPEC §17). */
export function createValidator(deps: AppDeps): Validator {
  return async (input: ValidatorInput): Promise<GateVerdict> => {
    const issueKey = input.issueKey.trim();
    if (issueKey.length === 0) {
      // Appel sans ticket : le doute bloque, jamais de laissez-passer (SPEC §20).
      return { result: false, errorMessage: text(GATE_MESSAGES, 'gate.unknownIssue', 'en') };
    }
    const issue = await resolveIssue(deps, issueKey);
    const language = await resolveLanguage(deps, issue?.projectId ?? '');
    const coverage = await readCoverage(deps, issueKey, issue?.id ?? '');
    if (!coverage) {
      return {
        result: false,
        errorMessage: text(GATE_MESSAGES, 'gate.coverageUnavailable', language),
      };
    }
    return evaluateGate(coverage, {
      language,
      modeOverride: modeFromConfiguration(input.configuration),
    });
  };
}

/** Résolution du ticket : un appel Jira, pour l'id réel et le projet (langue). */
async function resolveIssue(deps: AppDeps, issueKey: string): Promise<IssueRef | null> {
  try {
    return await deps.jira.getIssue(issueKey);
  } catch (error) {
    deps.logger.log('warn', `Ticket illisible pour le validateur : ${issueKey}`, error);
    return null;
  }
}

/** Lecture rapide de la couverture : par id résolu d'abord, puis par la clé. */
async function readCoverage(
  deps: AppDeps,
  issueKey: string,
  issueId: string,
): Promise<Coverage | null> {
  if (issueId.length > 0) {
    const byId = await deps.coverage.read(issueId);
    if (byId) return byId;
  }
  return deps.coverage.read(issueKey);
}

/** Langue du projet pour le message (SPEC §20) ; `en` par défaut. */
async function resolveLanguage(deps: AppDeps, projectId: string): Promise<Language> {
  if (projectId.length === 0) return 'en';
  const settings = await deps.store.getSettings(projectId);
  return settings?.language ?? 'en';
}

/** Le mode configuré dans l'éditeur de workflow prime (SPEC §16.5). */
function modeFromConfiguration(configuration: Record<string, unknown>): GateMode | undefined {
  const raw = configuration['mode'] ?? configuration['gateMode'];
  return typeof raw === 'string' && (GATE_MODES as readonly string[]).includes(raw)
    ? (raw as GateMode)
    : undefined;
}
