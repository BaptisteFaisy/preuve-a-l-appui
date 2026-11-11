/**
 * ViewModel pur pour la matrice critères × preuves (SPEC §16.1, FP-10).
 *
 * Transforme la couverture stockée en lignes prêtes à l'affichage :
 * libellés traduits, statuts, couleurs, preuves formatées, actions
 * autorisées. Les `.tsx` ne font que rendre ces structures.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { text } from '../i18n/index.js';
import { UI_MESSAGES } from '../i18n/ui.js';
import type {
  Coverage,
  CriterionRevision,
  CriterionState,
  Evidence,
  Freshness,
  Language,
  Strength,
} from '../types.js';

export type MatrixStatusKind = 'proven' | 'waived' | 'missing' | 'to-reconfirm';
export type LozengeAppearance = 'success' | 'moved' | 'inprogress' | 'removed' | 'default';
export type StrengthTagColor = 'green' | 'blue' | 'grey';

/** Modes des dialogues d'action de la matrice (boutons par ligne). */
export type MatrixDialogMode = 'none' | 'attach' | 'attest' | 'request' | 'waive' | 'history';

export interface FormattedEvidenceItem {
  readonly id: string;
  readonly type: string;
  readonly typeLabel: string;
  readonly reference: string;
  readonly note: string;
  readonly strength: Strength;
  readonly strengthLabel: string;
  readonly strengthColor: StrengthTagColor;
  readonly freshness: Freshness;
  readonly freshnessLabel: string;
  readonly verified: boolean;
  readonly addedByAgent: boolean;
  readonly commit: string;
}

export interface MatrixRowViewModel {
  readonly criterionId: string;
  readonly code: string;
  readonly text: string;
  readonly type: string;
  readonly typeLabel: string;
  readonly requiredStrength: Strength;
  readonly requiredStrengthLabel: string;
  readonly status: MatrixStatusKind;
  readonly statusLabel: string;
  readonly statusAppearance: LozengeAppearance;
  readonly isProven: boolean;
  readonly isWaived: boolean;
  readonly hasDefect: boolean;
  readonly defectLabel: string;
  readonly expectedProof: string;
  readonly version: number;
  readonly waiverId: string;
  readonly evidences: readonly FormattedEvidenceItem[];
  readonly canAttest: boolean;
  readonly canWaive: boolean;
  readonly canAttach: boolean;
}

/**
 * Droits de geste de l'acteur courant, calculés par le résolveur avec les
 * règles du domaine (`canAttest`, `isRoleAllowedToWaive`) : la vue ne décide
 * rien, elle affiche ce qui est autorisé (SPEC §9.4, §12.4).
 */
export interface MatrixRights {
  /** Identifiants des critères que l'acteur peut attester. */
  readonly attestable: ReadonlySet<string>;
  /** L'acteur peut-il accorder une dérogation ? */
  readonly waivable: boolean;
}

export interface MatrixViewModel {
  readonly issueKey: string;
  readonly total: number;
  readonly proven: number;
  readonly waived: number;
  readonly passes: boolean;
  readonly summaryText: string;
  readonly waivedText: string;
  readonly rows: readonly MatrixRowViewModel[];
  readonly defectsCount: number;
  readonly hasCriteria: boolean;
}

export interface HistoryItemViewModel {
  readonly version: number;
  readonly text: string;
  readonly type: string;
  readonly changedBy: string;
  readonly dateFormatted: string;
  readonly label: string;
}

/* ------------------------------------------------------------------ statuts */

export function resolveStatusKind(crit: CriterionState): MatrixStatusKind {
  if (crit.proven) return 'proven';
  if (crit.waived) return 'waived';
  const hasReconfirm = crit.evidences.some((e) => e.freshness === 'to-reconfirm');
  if (hasReconfirm || crit.defect === 'not-fresh') return 'to-reconfirm';
  return 'missing';
}

const STATUS_KEY: Readonly<Record<MatrixStatusKind, string>> = {
  proven: 'ui.matrix.status.proven',
  waived: 'ui.matrix.status.waived',
  'to-reconfirm': 'ui.matrix.status.toReconfirm',
  missing: 'ui.matrix.status.missing',
};

export function resolveLozengeAppearance(kind: MatrixStatusKind): LozengeAppearance {
  switch (kind) {
    case 'proven':
      return 'success';
    case 'waived':
      return 'moved';
    case 'to-reconfirm':
      return 'inprogress';
    default:
      return 'removed';
  }
}

/** Couleur du Tag de force : vert = machine, bleu = attesté, gris = déclaré. */
export function strengthTagColor(strength: Strength): StrengthTagColor {
  if (strength === 'machine-verified') return 'green';
  if (strength === 'attested') return 'blue';
  return 'grey';
}

/* ------------------------------------------------------------------ dialogues */

const DIALOG_TITLE_KEY: Readonly<Record<MatrixDialogMode, string>> = {
  none: '',
  attach: 'ui.matrix.action.attach',
  attest: 'ui.matrix.action.attest',
  request: 'ui.matrix.action.requestAttestation',
  waive: 'ui.matrix.action.waive',
  history: 'ui.matrix.form.historyTitle',
};

const DIALOG_LABEL_KEY: Readonly<Record<MatrixDialogMode, string>> = {
  none: '',
  attach: 'ui.matrix.form.reference',
  attest: 'ui.matrix.form.attestationNote',
  request: 'ui.matrix.form.requestTarget',
  waive: 'ui.matrix.form.waiverReason',
  history: '',
};

export function dialogTitleKey(mode: MatrixDialogMode): string {
  return DIALOG_TITLE_KEY[mode];
}

export function dialogLabelKey(mode: MatrixDialogMode): string {
  return DIALOG_LABEL_KEY[mode];
}

/* ------------------------------------------------------------------- formatage */

export function formatEvidenceItem(evidence: Evidence, language: Language): FormattedEvidenceItem {
  return {
    id: evidence.id,
    type: evidence.type,
    typeLabel: text(UI_MESSAGES, `evidence.type.${evidence.type}`, language),
    reference: evidence.reference,
    note: evidence.note,
    strength: evidence.strength,
    strengthLabel: text(UI_MESSAGES, `strength.${evidence.strength}`, language),
    strengthColor: strengthTagColor(evidence.strength),
    freshness: evidence.freshness,
    freshnessLabel: text(UI_MESSAGES, `freshness.${evidence.freshness}`, language),
    verified: evidence.verified,
    addedByAgent: evidence.addedByAgent,
    commit: evidence.commit,
  };
}

export function buildMatrixRow(
  crit: CriterionState,
  language: Language,
  rights?: MatrixRights,
): MatrixRowViewModel {
  const status = resolveStatusKind(crit);
  return {
    criterionId: crit.criterionId,
    code: crit.code,
    text: crit.text,
    type: crit.type,
    typeLabel: text(UI_MESSAGES, `criterion.type.${crit.type}`, language),
    requiredStrength: crit.requiredStrength,
    requiredStrengthLabel: text(UI_MESSAGES, `strength.${crit.requiredStrength}`, language),
    status,
    statusLabel: text(UI_MESSAGES, STATUS_KEY[status], language),
    statusAppearance: resolveLozengeAppearance(status),
    isProven: crit.proven,
    isWaived: crit.waived,
    hasDefect: crit.defect !== null,
    defectLabel: crit.defect ? text(UI_MESSAGES, `defect.${crit.defect}`, language) : '',
    expectedProof: crit.expected,
    version: crit.version,
    waiverId: crit.waiverId,
    evidences: crit.evidences.map((e) => formatEvidenceItem(e, language)),
    // SPEC §7.3 : l'attestation en un geste ; on ne ré-atteste pas un critère
    // prouvé, et seuls les acteurs indépendants le peuvent (SPEC §9.4).
    canAttest: !crit.proven && (rights ? rights.attestable.has(crit.criterionId) : true),
    canWaive: !crit.proven && !crit.waived && (rights ? rights.waivable : true),
    canAttach: true,
  };
}

export function buildMatrixViewModel(
  coverage: Coverage | null,
  language: Language,
  issueKeyFallback = '',
  rights?: MatrixRights,
): MatrixViewModel {
  if (!coverage) {
    return {
      issueKey: issueKeyFallback,
      total: 0,
      proven: 0,
      waived: 0,
      passes: false,
      summaryText: text(UI_MESSAGES, 'ui.matrix.empty', language),
      waivedText: '',
      rows: [],
      defectsCount: 0,
      hasCriteria: false,
    };
  }

  const rows = sortRowsByDefect(coverage.criteria.map((c) => buildMatrixRow(c, language, rights)));
  return {
    issueKey: coverage.issueKey,
    total: coverage.total,
    proven: coverage.proven,
    waived: coverage.waived,
    passes: coverage.passes,
    summaryText: text(UI_MESSAGES, 'ui.matrix.coverageSummary', language, {
      proven: coverage.proven,
      total: coverage.total,
    }),
    waivedText:
      coverage.waived > 0
        ? text(UI_MESSAGES, 'ui.matrix.waivedCount', language, { waived: coverage.waived })
        : '',
    rows,
    defectsCount: rows.filter((r) => r.hasDefect).length,
    hasCriteria: coverage.total > 0,
  };
}

/** Les critères en défaut d'abord, puis ordre naturel des codes (SPEC §16.1). */
export function sortRowsByDefect(rows: readonly MatrixRowViewModel[]): MatrixRowViewModel[] {
  return [...rows].sort((a, b) => {
    if (a.isProven !== b.isProven) return a.isProven ? 1 : -1;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
}

export function formatRevisionItem(
  revision: CriterionRevision,
  code: string,
  language: Language,
): HistoryItemViewModel {
  const dateFormatted = revision.at ? revision.at.slice(0, 10) : '';
  return {
    version: revision.version,
    text: revision.text,
    type: revision.type,
    changedBy: revision.changedBy,
    dateFormatted,
    label: text(UI_MESSAGES, 'ui.matrix.form.versionLabel', language, {
      code,
      version: revision.version,
      author: revision.changedBy || text(UI_MESSAGES, 'ui.common.unknown', language),
      date: dateFormatted,
    }),
  };
}
