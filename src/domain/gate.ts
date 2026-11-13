/**
 * Verdict du validateur et formatage du message d'erreur (SPEC §7.2, §12.1, §19).
 *
 * Principes stricts :
 * - Deux critères nommés au plus (SPEC §19 : la longueur maximale du message
 *   d'erreur n'est pas documentée), renvoi au panneau pour le reste ;
 * - Le message nomme le critère et la preuve attendue (SPEC §5, principe 5) ;
 * - Messages en anglais et en français (SPEC §20) ;
 * - Trois modes : strict, souple, observation (SPEC §12.2) ;
 * - Le validateur ne reçoit pas l'identité de celui qui fait la transition
 *   (SPEC §12.1) : ce module ne voit que la couverture déjà calculée.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  BlockingItem,
  Coverage,
  CriterionState,
  GateMode,
  GateVerdict,
  Language,
} from '../types';
import { text } from '../i18n/index';
import { GATE_MESSAGES } from '../i18n/gate';

/** Au plus deux critères nommés dans le message (SPEC §19). */
export const MAX_NAMED_CRITERIA = 2;

export interface GateEvaluationOptions {
  language?: Language;
  /** Surcharge de mode : la configuration du validateur prime (SPEC §16.5). */
  modeOverride?: GateMode;
}

/**
 * Explique un défaut en une phrase, avec la force réellement reçue quand elle
 * est connue (SPEC §7.2 : « attestation d'un tiers attendue, déclaration reçue »).
 */
export function explainDefect(
  item: BlockingItem,
  states: readonly CriterionState[],
  language: Language,
): string {
  const state = states.find((s) => s.criterionId === item.criterionId);
  const got = state?.bestStrength ?? null;
  switch (item.defect) {
    case 'no-evidence':
      return text(GATE_MESSAGES, 'gate.defect.noEvidence', language);
    case 'weak-strength': {
      const gotLabel = got
        ? text(GATE_MESSAGES, `strength.${got}`, language)
        : text(GATE_MESSAGES, 'gate.defect.noEvidence', language);
      return text(GATE_MESSAGES, 'gate.defect.weakStrength', language, {
        expected: item.expected,
        got: gotLabel,
      });
    }
    case 'not-fresh':
      return text(GATE_MESSAGES, 'gate.defect.notFresh', language);
    case 'not-independent':
      return text(GATE_MESSAGES, 'gate.defect.notIndependent', language);
    case 'unverified':
      return text(GATE_MESSAGES, 'gate.defect.unverified', language);
    case 'no-criteria':
      return text(GATE_MESSAGES, 'gate.defect.noCriteria', language);
  }
}

/** Une ligne du message de blocage : `AC-3 « … » : attestation attendue.` (SPEC §7.2). */
export function formatBlockingLine(
  item: BlockingItem,
  states: readonly CriterionState[],
  language: Language,
): string {
  if (item.defect === 'no-criteria') return explainDefect(item, states, language);
  return text(GATE_MESSAGES, 'gate.line', language, {
    code: item.code,
    text: item.text,
    defect: explainDefect(item, states, language),
  });
}

/**
 * Message d'erreur complet (SPEC §7.2) : en-tête chiffré, deux critères nommés
 * au plus, puis renvoi au panneau du ticket pour le reste (SPEC §19).
 */
export function buildGateErrorMessage(
  blocking: readonly BlockingItem[],
  states: readonly CriterionState[],
  language: Language,
): string {
  if (blocking.length === 0) return '';
  if (blocking.length === 1 && blocking[0]?.defect === 'no-criteria') {
    return text(GATE_MESSAGES, 'gate.missingCriteria.block', language);
  }

  const headerKey = blocking.length === 1 ? 'gate.blocked.singular' : 'gate.blocked.plural';
  const lines = [text(GATE_MESSAGES, headerKey, language, { count: blocking.length })];

  const named = blocking.slice(0, MAX_NAMED_CRITERIA);
  for (const item of named) {
    lines.push(formatBlockingLine(item, states, language));
  }

  const remaining = blocking.length - named.length;
  if (remaining > 0) {
    lines.push(text(GATE_MESSAGES, 'gate.more', language, { count: remaining }));
  }
  return lines.join('\n');
}

/** Ce que le mode strict bloquerait : la base des trois modes (SPEC §12.2). */
export function strictBlocking(
  blocking: readonly BlockingItem[],
): readonly BlockingItem[] {
  return blocking;
}

/** En mode souple, seuls les critères majeurs bloquent (SPEC §12.2). */
export function lenientBlocking(
  blocking: readonly BlockingItem[],
): readonly BlockingItem[] {
  return blocking.filter((item) => !item.minor);
}

/** Verdict d'un mode donné sur les défauts restants. */
function verdictOf(
  mode: GateMode,
  blocking: readonly BlockingItem[],
  states: readonly CriterionState[],
  language: Language,
): GateVerdict {
  if (mode === 'observe') {
    // Rien n'est bloqué ; `wouldBlock` a déjà été compté dans la couverture.
    return { result: true, errorMessage: '' };
  }
  const effective = mode === 'lenient' ? lenientBlocking(blocking) : strictBlocking(blocking);
  if (effective.length === 0) return { result: true, errorMessage: '' };
  return { result: false, errorMessage: buildGateErrorMessage(effective, states, language) };
}

/**
 * Verdict du validateur (SPEC §12.1) : `result` + `errorMessage`.
 * Ne calcule rien : il lit la couverture stockée par le moteur (SPEC §17).
 */
export function evaluateGate(
  coverage: Coverage | null,
  options: GateEvaluationOptions = {},
): GateVerdict {
  const language = options.language ?? 'en';
  if (!coverage) {
    // Absence de ligne : le doute bloque (SPEC §20, intégrité du verdict).
    return {
      result: false,
      errorMessage: text(GATE_MESSAGES, 'gate.coverageUnavailable', language),
    };
  }
  return verdictOf(
    options.modeOverride ?? coverage.mode,
    coverage.blocking,
    coverage.criteria,
    language,
  );
}
