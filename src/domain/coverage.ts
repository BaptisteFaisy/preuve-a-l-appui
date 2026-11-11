/**
 * Évaluation de la couverture d'un critère et d'un ticket (SPEC §7.2, §12).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { reaches, STRENGTH_ORDER } from '../types.js';
import type {
  BlockingItem,
  Coverage,
  Criterion,
  CriterionState,
  Defect,
  Evidence,
  GateMode,
  Language,
  ProjectSettings,
  Strength,
  Waiver,
} from '../types.js';
import { text } from '../i18n/index.js';
import { GATE_MESSAGES } from '../i18n/gate.js';
import { findActiveWaiver } from './waivers.js';

export interface CriterionEvaluationInput {
  criterion: Criterion;
  evidences: readonly Evidence[];
  waivers: readonly Waiver[];
  settings: ProjectSettings;
  now: string;
}

/** Preuve attendue lisible pour le critère. */
export function defaultExpectedProof(
  requiredStrength: Strength,
  language: Language,
): string {
  if (requiredStrength === 'machine-verified') {
    return text(GATE_MESSAGES, 'gate.expected.machine-verified', language);
  }
  if (requiredStrength === 'attested') {
    return text(GATE_MESSAGES, 'gate.expected.attested', language);
  }
  return text(GATE_MESSAGES, 'gate.expected.declared', language);
}

/** Sélectionne la meilleure preuve pour un critère et diagnostique un défaut éventuel. */
export function evaluateCriterionEvidence(
  evidences: readonly Evidence[],
  criterion: Criterion,
): {
  bestEvidenceId: string;
  bestStrength: Strength | null;
  proven: boolean;
  defect: Defect | null;
} {
  const applicable = evidences.filter(
    (e) => e.criterionId === criterion.id && e.replacedBy === '',
  );
  if (applicable.length === 0) {
    return { bestEvidenceId: '', bestStrength: null, proven: false, defect: 'no-evidence' };
  }
  return pickBestEvidence(applicable, criterion);
}

/** Trie les preuves de la plus forte à la plus faible (comparaison déterministe). */
function byStrengthDesc(a: Evidence, b: Evidence): number {
  return STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength] || a.id.localeCompare(b.id);
}

function pickBestEvidence(
  evidences: readonly Evidence[],
  criterion: Criterion,
): {
  bestEvidenceId: string;
  bestStrength: Strength | null;
  proven: boolean;
  defect: Defect | null;
} {
  // Une preuve fraîche, vérifiée, sur la version courante, qui atteint l'exigence
  const valid = evidences.filter(
    (e) =>
      e.freshness === 'fresh' &&
      e.verified &&
      e.criterionVersion >= criterion.version &&
      reaches(e.strength, criterion.requiredStrength),
  );
  if (valid.length > 0) {
    const best = [...valid].sort(byStrengthDesc)[0]!;
    return { bestEvidenceId: best.id, bestStrength: best.strength, proven: true, defect: null };
  }
  return diagnoseDefectiveEvidence(evidences, criterion);
}

function diagnoseDefectiveEvidence(
  evidences: readonly Evidence[],
  criterion: Criterion,
): {
  bestEvidenceId: string;
  bestStrength: Strength | null;
  proven: boolean;
  defect: Defect;
} {
  // Le diagnostic porte sur la meilleure preuve disponible, pas sur la première
  const candidate = [...evidences].sort(byStrengthDesc)[0]!;
  const base = {
    bestEvidenceId: candidate.id,
    bestStrength: candidate.strength,
    proven: false,
  };
  if (!candidate.verified) return { ...base, defect: 'unverified' };
  if (candidate.freshness !== 'fresh') return { ...base, defect: 'not-fresh' };
  if (candidate.criterionVersion < criterion.version) return { ...base, defect: 'not-fresh' };
  if (!reaches(candidate.strength, criterion.requiredStrength)) {
    return { ...base, defect: 'weak-strength' };
  }
  return { ...base, defect: 'no-evidence' };
}

/** Évalue l'état complet d'un critère (SPEC §16.1). */
export function evaluateCriterionState(input: CriterionEvaluationInput): CriterionState {
  const { criterion, settings, now } = input;
  const isMinor = settings.requirements[criterion.type]?.minor ?? false;
  const expected = defaultExpectedProof(criterion.requiredStrength, settings.language);
  const waiver = findActiveWaiver(criterion.id, input.waivers, now);
  const evResult = evaluateCriterionEvidence(input.evidences, criterion);

  const waived = waiver !== null;
  const proven = evResult.proven;
  const defect = proven || waived ? null : evResult.defect;

  return {
    criterionId: criterion.id,
    code: criterion.code,
    text: criterion.text,
    type: criterion.type,
    version: criterion.version,
    requiredStrength: criterion.requiredStrength,
    bestEvidenceId: evResult.bestEvidenceId,
    bestStrength: evResult.bestStrength,
    proven,
    waived,
    minor: isMinor,
    defect,
    expected,
    evidences: input.evidences.filter((e) => e.criterionId === criterion.id),
    waiverId: waiver?.id ?? '',
  };
}

export interface BuildCoverageInput {
  issueId: string;
  issueKey: string;
  criteria: readonly Criterion[];
  evidences: readonly Evidence[];
  waivers: readonly Waiver[];
  settings: ProjectSettings;
  now: string;
  childrenCovered?: boolean;
}

/** Calcule la couverture d'un ticket à partir des critères actifs et des réglages du projet. */
export function buildCoverage(input: BuildCoverageInput): Coverage {
  const { issueId, issueKey, settings, now } = input;
  const activeCriteria = input.criteria.filter((c) => c.status === 'active');
  const states = activeCriteria.map((c) =>
    evaluateCriterionState({
      criterion: c,
      evidences: input.evidences,
      waivers: input.waivers,
      settings,
      now,
    }),
  );

  return assembleCoverage({
    issueId,
    issueKey,
    states,
    settings,
    now,
    childrenCovered: input.childrenCovered ?? true,
  });
}

interface AssembleCoverageInput {
  issueId: string;
  issueKey: string;
  states: readonly CriterionState[];
  settings: ProjectSettings;
  now: string;
  childrenCovered: boolean;
}

function assembleCoverage(input: AssembleCoverageInput): Coverage {
  const { issueId, issueKey, states, settings, now, childrenCovered } = input;
  const total = states.length;
  const proven = states.filter((s) => s.proven).length;
  const waived = states.filter((s) => s.waived).length;
  const mode = settings.mode;

  const blockingItems = collectBlockingItems(states, settings, childrenCovered);
  const gating = computeGating(mode, blockingItems);

  return {
    issueId,
    issueKey,
    total,
    proven,
    waived,
    mode,
    passes: gating.passes,
    wouldBlock: gating.wouldBlock,
    blocking: blockingItems,
    criteria: states,
    updatedAt: now,
  };
}

function collectBlockingItems(
  states: readonly CriterionState[],
  settings: ProjectSettings,
  childrenCovered: boolean,
): BlockingItem[] {
  if (states.length === 0) {
    return handleEmptyCriteria(settings);
  }
  const items: BlockingItem[] = [];
  for (const s of states) {
    if (!s.proven && !s.waived && s.defect !== null) {
      items.push({
        criterionId: s.criterionId,
        code: s.code,
        text: s.text,
        defect: s.defect,
        expected: s.expected,
        minor: s.minor,
      });
    }
  }
  if (settings.requireChildren && !childrenCovered) {
    items.push({
      criterionId: 'children',
      code: 'SUBTASKS',
      text: text(GATE_MESSAGES, 'gate.childrenNotCovered', settings.language),
      defect: 'no-evidence',
      expected: text(GATE_MESSAGES, 'gate.childrenNotCovered', settings.language),
      minor: false,
    });
  }
  return items;
}

function handleEmptyCriteria(settings: ProjectSettings): BlockingItem[] {
  if (settings.missingCriteria === 'block') {
    return [
      {
        criterionId: 'none',
        code: 'CRIT-0',
        text: text(GATE_MESSAGES, 'gate.missingCriteria.block', settings.language),
        defect: 'no-criteria',
        expected: text(GATE_MESSAGES, 'gate.missingCriteria.block', settings.language),
        minor: false,
      },
    ];
  }
  return [];
}

function computeGating(
  mode: GateMode,
  blocking: readonly BlockingItem[],
): { passes: boolean; wouldBlock: boolean } {
  const strictBlocks = blocking.length > 0;
  if (mode === 'strict') {
    return { passes: !strictBlocks, wouldBlock: strictBlocks };
  }
  if (mode === 'lenient') {
    // En mode lenient, seuls les critères mineurs passent (SPEC §12.2)
    const hasMajorDefect = blocking.some((item) => !item.minor);
    return { passes: !hasMajorDefect, wouldBlock: strictBlocks };
  }
  // observe : rien n'est bloqué, wouldBlock enregistre ce qui l'aurait été
  return { passes: true, wouldBlock: strictBlocks };
}

/** Libellé du champ « Preuves n / m » affiché sur le ticket (SPEC §12.3, FP-16). */
export function coverageFieldLabel(proven: number, total: number, language: Language): string {
  return text(GATE_MESSAGES, 'coverage.field.label', language, { proven, total });
}
