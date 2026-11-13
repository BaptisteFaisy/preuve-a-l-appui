/**
 * Le view-model du simulateur : ce que la section affiche, assemblé à partir
 * de ce que l'app produit déjà.
 *
 * Aucune règle n'est recalculée ici :
 * - les lignes des critères viennent du view-model réel du panneau Forge
 *   (`src/viewmodel/matrix.ts` : libellés traduits, état, force exigée,
 *   preuves formatées) ;
 * - la couverture « n / m » vient du champ réel (`src/viewmodel/coverage.ts`) ;
 * - la force retenue pour un critère vient de la ligne de couverture que le
 *   MOTEUR de couverture a rangée (`coverage.criteria[].bestStrength`),
 *   libellée par le dictionnaire de l'app (`src/i18n/ui.ts`) ;
 * - les types de preuve sont les six du domaine (`EVIDENCE_TYPES`) et leurs
 *   libellés aussi.
 *
 * Le simulateur n'ajoute qu'une chose : le rôle de la personne que le visiteur
 * peut faire jouer (agent, assignée, testeuse, product owner), affiché avec le
 * nom porté par l'instantané — jamais un identifiant de compte.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Coverage,
  CriterionState,
  EvidenceType,
  Language,
  Strength,
} from '../../../../../src/types.js';
import { EVIDENCE_TYPES } from '../../../../../src/types.js';
import { text } from '../../../../../src/i18n/index.js';
import { UI_MESSAGES } from '../../../../../src/i18n/ui.js';
import type {
  FormattedEvidenceItem,
  MatrixStatusKind,
  MatrixViewModel,
  MatrixRowViewModel,
} from '../../../../../src/viewmodel/matrix.js';
import type { CoverageFieldViewModel } from '../../../../../src/viewmodel/coverage.js';
import type { DemoActors } from '../../../demo/world.js';
import { SIMULATOR_STRINGS, type SimulatorRole } from '../../../i18n/simulator.js';

/** Une preuve attachée, telle que l'app la formate. */
export interface SimulatorProof {
  readonly id: string;
  readonly typeLabel: string;
  readonly strengthLabel: string;
  readonly reference: string;
  readonly freshnessLabel: string;
  readonly addedByAgent: boolean;
}

/** L'état d'un critère, avant et après le geste du visiteur. */
export interface SimulatorCriterion {
  readonly code: string;
  readonly text: string;
  readonly typeLabel: string;
  readonly requiredStrengthLabel: string;
  readonly bestStrength: Strength | null;
  readonly bestStrengthLabel: string;
  readonly status: MatrixStatusKind;
  readonly statusLabel: string;
  readonly proven: boolean;
  readonly defectLabel: string;
  readonly expected: string;
  readonly proofs: readonly SimulatorProof[];
}

/** Une personne que le visiteur peut faire attacher une preuve. */
export interface SimulatorActorOption {
  readonly role: SimulatorRole;
  readonly label: string;
  readonly name: string;
  readonly agent: boolean;
}

/** Un des six types de preuve du domaine. */
export interface SimulatorTypeOption {
  readonly type: EvidenceType;
  readonly label: string;
}

/** Ce que le simulateur affiche, en une seule lecture. */
export interface SimulatorView {
  readonly issueKey: string;
  readonly coverageLabel: string;
  readonly coverageText: string;
  readonly coverageTooltip: string;
  readonly proven: number;
  readonly total: number;
  readonly passes: boolean;
  readonly criteria: readonly SimulatorCriterion[];
  readonly actors: readonly SimulatorActorOption[];
  readonly types: readonly SimulatorTypeOption[];
}

/** Les entrée du constructeur : que des sorties de l'app. */
export interface SimulatorViewInput {
  readonly coverage: Coverage | null;
  readonly matrix: MatrixViewModel;
  readonly field: CoverageFieldViewModel;
  readonly actors: DemoActors;
  readonly language: Language;
}

/** Les quatre rôles, dans l'ordre où le visiteur les voit. */
const ROLES: readonly SimulatorRole[] = ['agent', 'developer', 'tester', 'owner'];

/** La force retenue par le moteur, libellée par le dictionnaire de l'app. */
function keptStrength(state: Strength | null, language: Language): string {
  return state === null ? '' : text(UI_MESSAGES, `strength.${state}`, language);
}

/** Une ligne de la matrice + son état dans la couverture : la vue du critère. */
function criterionOf(
  row: MatrixRowViewModel,
  state: CriterionState | undefined,
  language: Language,
): SimulatorCriterion {
  const best = state?.bestStrength ?? null;
  return {
    code: row.code,
    text: row.text,
    typeLabel: row.typeLabel,
    requiredStrengthLabel: row.requiredStrengthLabel,
    bestStrength: best,
    bestStrengthLabel: keptStrength(best, language),
    status: row.status,
    statusLabel: row.statusLabel,
    proven: row.isProven,
    defectLabel: row.defectLabel,
    expected: state?.expected ?? '',
    proofs: row.evidences.map((item: FormattedEvidenceItem) => ({
      id: item.id,
      typeLabel: item.typeLabel,
      strengthLabel: item.strengthLabel,
      reference: item.reference,
      freshnessLabel: item.freshnessLabel,
      addedByAgent: item.addedByAgent,
    })),
  };
}

/** Les personnes du casting, nommées par l'instantané, jamais par un compte. */
function actorOptions(actors: DemoActors, language: Language): SimulatorActorOption[] {
  const labels = SIMULATOR_STRINGS[language].roles;
  return ROLES.map((role: SimulatorRole) => ({
    role,
    label: labels[role],
    name: actors[role].displayName,
    agent: actors[role].agent,
  }));
}

/** Les six types de preuve du domaine, libellés par l'app. */
function typeOptions(language: Language): SimulatorTypeOption[] {
  return EVIDENCE_TYPES.map((type: EvidenceType) => ({
    type,
    label: text(UI_MESSAGES, `evidence.type.${type}`, language),
  }));
}

/** Assemble la vue du simulateur à partir des seules sorties de l'app. */
export function buildSimulatorView(input: SimulatorViewInput): SimulatorView {
  const { coverage, matrix, field, actors, language } = input;
  const stateByCriterion = new Map<string, CriterionState>(
    (coverage?.criteria ?? []).map((state) => [state.criterionId, state]),
  );
  return {
    issueKey: matrix.issueKey,
    coverageLabel: field.label,
    coverageText: matrix.summaryText,
    coverageTooltip: field.tooltip,
    proven: matrix.proven,
    total: matrix.total,
    passes: matrix.passes,
    criteria: matrix.rows.map((row) =>
      criterionOf(row, stateByCriterion.get(row.criterionId), language),
    ),
    actors: actorOptions(actors, language),
    types: typeOptions(language),
  };
}
