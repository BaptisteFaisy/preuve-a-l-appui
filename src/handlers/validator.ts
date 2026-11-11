/**
 * Validateur de workflow (SPEC §12.1, §17).
 *
 * La fonction ne calcule rien : elle lit la ligne de couverture tenue à jour
 * par le moteur (SPEC §17, §22 point 10), compose le message d'erreur au
 * format du SPEC §7.2 et répond vite (SPEC §20 : moins d'une seconde).
 * Elle ne reçoit pas l'identité de celui qui fait la transition (SPEC §12.1) :
 * les dérogations se donnent avant, dans le panneau du ticket.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { Coverage, GateMode, GateVerdict, Language } from '../types.js';
import { GATE_MODES } from '../db/mapping-common.js';
import { evaluateGate } from '../domain/gate.js';
import { text } from '../i18n/index.js';
import { GATE_MESSAGES } from '../i18n/gate.js';

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
      return { result: true, errorMessage: '' };
    }
    const coverage = await readCoverage(deps, issueKey);
    const language = await resolveLanguage(deps, issueKey);
    if (!coverage) {
      // Le doute bloque (SPEC §20) : message dédié, jamais « tout est prouvé ».
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

/** Lecture rapide : d'abord par la clé fournie, sinon par l'id résolu via Jira. */
async function readCoverage(deps: AppDeps, issueKey: string): Promise<Coverage | null> {
  const direct = await deps.coverage.read(issueKey);
  if (direct) return direct;
  const issue = await deps.jira.getIssue(issueKey);
  if (!issue) return null;
  return deps.coverage.read(issue.id);
}

/** Langue du projet pour le message (SPEC §20) ; `en` par défaut. */
async function resolveLanguage(deps: AppDeps, issueKey: string): Promise<Language> {
  const dash = issueKey.indexOf('-');
  const projectKey = dash > 0 ? issueKey.slice(0, dash) : issueKey;
  const settings = await deps.store.getSettings(projectKey);
  return settings?.language ?? 'en';
}

/** Le mode configuré dans l'éditeur de workflow prime (SPEC §16.5). */
function modeFromConfiguration(configuration: Record<string, unknown>): GateMode | undefined {
  const raw = configuration['mode'] ?? configuration['gateMode'];
  return typeof raw === 'string' && (GATE_MODES as readonly string[]).includes(raw)
    ? (raw as GateMode)
    : undefined;
}
