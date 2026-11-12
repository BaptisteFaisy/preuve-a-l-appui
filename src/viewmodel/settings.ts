/**
 * ViewModel pur pour la page de réglages projet (SPEC §16.3, §9.2, §10).
 *
 * Grille d'exigences par type, rôles autorisés, mode du validateur,
 * politique sans critères, et génération de la commande CI à copier.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { defaultProjectSettings } from '../defaults';
import { text } from '../i18n/index';
import { UI_MESSAGES } from '../i18n/ui';
import { CRITERION_TYPES } from '../types';
import type {
  CriterionType,
  GateMode,
  Language,
  MissingCriteriaPolicy,
  ProjectSettings,
  Requirement,
  RolePolicy,
} from '../types';

export interface RequirementRowViewModel {
  readonly type: CriterionType;
  readonly typeLabel: string;
  readonly acceptedStrengths: string;
  readonly attesterRole: string;
  readonly notAuthor: boolean;
  readonly measurementLink: boolean;
  readonly minor: boolean;
  readonly constraintsLabel: string;
}

export interface GateModeOptionViewModel {
  readonly value: GateMode;
  readonly label: string;
  readonly description: string;
  readonly isSelected: boolean;
}

export interface SettingsViewModel {
  readonly projectId: string;
  readonly mode: GateMode;
  readonly modeLabel: string;
  readonly modeOptions: readonly GateModeOptionViewModel[];
  readonly missingCriteria: MissingCriteriaPolicy;
  readonly missingCriteriaLabel: string;
  readonly roles: RolePolicy;
  readonly requirements: readonly RequirementRowViewModel[];
  readonly ciKeyHash: string;
  readonly ciCommand: string;
  readonly requireChildren: boolean;
  readonly language: Language;
}

/**
 * Commande de CI à copier dans le pipeline (SPEC §10).
 * Une seule ligne portable qui signe le rapport et le poste au webtrigger.
 */
export function generateCiCommand(projectKeyOrId: string, ciKeyVariable = '$PROOF_CI_KEY'): string {
  return (
    `curl -sS -X POST "https://api.atlassian.com/forge/entities/ci-results" ` +
    `-H "Content-Type: application/json" ` +
    `-H "X-Project-Key: ${projectKeyOrId}" ` +
    `-H "X-Proof-Signature: $(echo -n "$REPORT" | openssl dgst -sha256 -hmac "${ciKeyVariable}" -binary | base64)" ` +
    `-d "$REPORT"`
  );
}

function buildConstraintsLabel(req: Requirement, language: Language): string {
  const parts: string[] = [];
  if (req.notAuthor) parts.push(text(UI_MESSAGES, 'ui.settings.constraint.notAuthor', language));
  if (req.measurementLink) {
    parts.push(text(UI_MESSAGES, 'ui.settings.constraint.measurementLink', language));
  }
  return parts.length > 0 ? parts.join(', ') : '-';
}

function formatRequirementRow(
  type: CriterionType,
  req: Requirement,
  language: Language,
): RequirementRowViewModel {
  const acceptedStrengths = req.accepted
    .map((s) => text(UI_MESSAGES, `strength.${s}`, language))
    .join(', ');

  return {
    type,
    typeLabel: text(UI_MESSAGES, `criterion.type.${type}`, language),
    acceptedStrengths,
    attesterRole: req.attesterRole || text(UI_MESSAGES, 'ui.common.none', language),
    notAuthor: req.notAuthor,
    measurementLink: req.measurementLink,
    minor: req.minor,
    constraintsLabel: buildConstraintsLabel(req, language),
  };
}

const MODES: readonly GateMode[] = ['strict', 'lenient', 'observe'];

export function buildGateModeOptions(
  selected: GateMode,
  language: Language,
): readonly GateModeOptionViewModel[] {
  return MODES.map((mode) => ({
    value: mode,
    label: text(UI_MESSAGES, `ui.settings.mode.short.${mode}`, language),
    description: text(UI_MESSAGES, `ui.settings.mode.${mode}`, language),
    isSelected: mode === selected,
  }));
}

export function buildSettingsViewModel(
  settings: ProjectSettings | null,
  projectId: string,
  language: Language,
): SettingsViewModel {
  const current = settings ?? defaultProjectSettings(projectId);
  const requirements: RequirementRowViewModel[] = CRITERION_TYPES.map((t) =>
    formatRequirementRow(t, current.requirements[t], language),
  );

  return {
    projectId: current.projectId,
    mode: current.mode,
    modeLabel: text(UI_MESSAGES, `ui.settings.mode.${current.mode}`, language),
    modeOptions: buildGateModeOptions(current.mode, language),
    missingCriteria: current.missingCriteria,
    missingCriteriaLabel: text(UI_MESSAGES, `ui.settings.missing.${current.missingCriteria}`, language),
    roles: current.roles,
    requirements,
    ciKeyHash: current.ciKeyHash,
    ciCommand: generateCiCommand(current.projectId),
    requireChildren: current.requireChildren,
    language: current.language,
  };
}
