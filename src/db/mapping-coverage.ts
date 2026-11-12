/**
 * Mapping de la couverture et des réglages projet (SPEC §9.2, §12, §16, §18).
 *
 * Ces deux lignes sont les plus lues de l'app : le validateur ne lit que la
 * couverture (SPEC §17), les écrans ne lisent que la matrice. Les deux
 * collections riches (`blocking`, `criteria`) sont du TEXT sérialisé — le type
 * `JSON` de Forge SQL est en sursis et revient de toute façon en `string`
 * (R4 §3).
 *
 * Un repli est documenté par colonne : une couverture illisible se lit comme
 * « rien n'est prouvé » (`passes = false`), jamais comme « tout est prouvé » ;
 * une grille d'exigences illisible retombe sur `DEFAULT_REQUIREMENTS`
 * (SPEC §9.2), pas sur une grille vide.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  BlockingItem,
  Coverage,
  CriterionState,
  CriterionType,
  Defect,
  Evidence,
  ProjectSettings,
  Requirement,
  RequirementGrid,
  RolePolicy,
  Strength,
} from '../types';
import { DEFAULT_REQUIREMENTS, DEFAULT_ROLES } from '../defaults';
import {
  CRITERION_TYPES,
  DEFECTS,
  GATE_MODES,
  LANGUAGES,
  MISSING_CRITERIA_POLICIES,
  STRENGTHS,
  fromSqlBoolean,
  fromTimestamp,
  isObject,
  jsonText,
  numberOrZero,
  parseEnum,
  parseJson,
  parseObjectList,
  parseStringList,
  text,
  toNumber,
  toSqlBoolean,
  toTimestamp,
} from './mapping-common';
import { parseEvidenceValue } from './mapping-evidence';

/* ---------------------------------------------------------------- coverage */

/** Une ligne de `coverage`, telle que Forge la rend. */
export interface CoverageRow {
  issue_id: string;
  issue_key: string;
  total: number;
  proven: number;
  waived: number;
  mode: string;
  passes: number | boolean;
  would_block: number | boolean;
  blocking_json: string;
  criteria_json: string;
  updated_at: string;
}

export const COVERAGE_COLUMNS = [
  'issue_id',
  'issue_key',
  'total',
  'proven',
  'waived',
  'mode',
  'passes',
  'would_block',
  'blocking_json',
  'criteria_json',
  'updated_at',
] as const satisfies readonly (keyof CoverageRow)[];

/** Écrit la couverture d'un ticket ; les deux listes partent en TEXT. */
export function coverageToRow(coverage: Coverage): CoverageRow {
  return {
    issue_id: coverage.issueId,
    issue_key: coverage.issueKey,
    total: coverage.total,
    proven: coverage.proven,
    waived: coverage.waived,
    mode: coverage.mode,
    passes: toSqlBoolean(coverage.passes),
    would_block: toSqlBoolean(coverage.wouldBlock),
    blocking_json: jsonText(coverage.blocking),
    criteria_json: jsonText(coverage.criteria),
    updated_at: toTimestamp(coverage.updatedAt),
  };
}

/** Une ligne de blocage : sans critère nommé, elle ne peut rien expliquer. */
export function parseBlockingItemValue(raw: unknown): BlockingItem | null {
  if (!isObject(raw)) return null;
  const criterionId = text(raw['criterionId']);
  if (criterionId.length === 0) return null;
  return {
    criterionId,
    code: text(raw['code']),
    text: text(raw['text']),
    defect: parseEnum(raw['defect'], DEFECTS, 'no-evidence'),
    expected: text(raw['expected']),
    minor: fromSqlBoolean(raw['minor']),
  };
}

/** Les lignes du message de blocage (SPEC §7.2), depuis un tableau ou un TEXT. */
export function parseBlockingItems(raw: unknown): BlockingItem[] {
  return parseObjectList(raw).flatMap((item) => {
    const blocking = parseBlockingItemValue(item);
    return blocking ? [blocking] : [];
  });
}

/**
 * L'état d'un critère dans la matrice (SPEC §16.1). `bestStrength` et
 * `defect` sont les deux seuls champs réellement nuls du domaine : une
 * absence est conservée `null`, jamais remplacée par une valeur par défaut.
 */
export function parseCriterionStateValue(raw: unknown): CriterionState | null {
  if (!isObject(raw)) return null;
  const criterionId = text(raw['criterionId']);
  if (criterionId.length === 0) return null;
  return {
    criterionId,
    code: text(raw['code']),
    text: text(raw['text']),
    type: parseEnum(raw['type'], CRITERION_TYPES, 'functional'),
    version: toNumber(raw['version']),
    requiredStrength: parseEnum(raw['requiredStrength'], STRENGTHS, 'declared'),
    bestEvidenceId: text(raw['bestEvidenceId']),
    bestStrength: parseNullableStrength(raw['bestStrength']),
    proven: fromSqlBoolean(raw['proven']),
    waived: fromSqlBoolean(raw['waived']),
    minor: fromSqlBoolean(raw['minor']),
    defect: parseNullableDefect(raw['defect']),
    expected: text(raw['expected']),
    evidences: parseEvidenceList(raw['evidences']),
    waiverId: text(raw['waiverId']),
  };
}

/** La matrice complète, depuis un tableau ou un TEXT. */
export function parseCriterionStates(raw: unknown): CriterionState[] {
  return parseObjectList(raw).flatMap((item) => {
    const state = parseCriterionStateValue(item);
    return state ? [state] : [];
  });
}

function parseNullableStrength(value: unknown): Strength | null {
  return value === null || value === undefined ? null : parseEnum(value, STRENGTHS, 'declared');
}

function parseNullableDefect(value: unknown): Defect | null {
  return value === null || value === undefined ? null : parseEnum(value, DEFECTS, 'no-evidence');
}

function parseEvidenceList(value: unknown): Evidence[] {
  return parseObjectList(value).map((item) => parseEvidenceValue(item));
}

/** Lit une couverture. Mode illisible → `strict` : le doute bloque. */
export function parseCoverageValue(raw: unknown): Coverage {
  const source = isObject(raw) ? raw : {};
  return {
    issueId: text(source['issueId']),
    issueKey: text(source['issueKey']),
    total: numberOrZero(source['total']),
    proven: numberOrZero(source['proven']),
    waived: numberOrZero(source['waived']),
    mode: parseEnum(source['mode'], GATE_MODES, 'strict'),
    passes: fromSqlBoolean(source['passes']),
    wouldBlock: fromSqlBoolean(source['wouldBlock']),
    blocking: parseBlockingItems(source['blocking']),
    criteria: parseCriterionStates(source['criteria']),
    updatedAt: fromTimestamp(source['updatedAt']),
  };
}

export function rowToCoverage(row: CoverageRow): Coverage {
  return parseCoverageValue({
    issueId: row.issue_id,
    issueKey: row.issue_key,
    total: row.total,
    proven: row.proven,
    waived: row.waived,
    mode: row.mode,
    passes: row.passes,
    wouldBlock: row.would_block,
    blocking: row.blocking_json,
    criteria: row.criteria_json,
    updatedAt: row.updated_at,
  });
}

/* ---------------------------------------------------------------- settings */

/** Une ligne de `settings`, telle que Forge la rend. */
export interface ProjectSettingsRow {
  project_id: string;
  requirements_json: string;
  mode: string;
  roles_json: string;
  missing_criteria: string;
  ci_key_hash: string;
  require_children: number | boolean;
  language: string;
  updated_at: string;
}

export const SETTINGS_COLUMNS = [
  'project_id',
  'requirements_json',
  'mode',
  'roles_json',
  'missing_criteria',
  'ci_key_hash',
  'require_children',
  'language',
  'updated_at',
] as const satisfies readonly (keyof ProjectSettingsRow)[];

export function projectSettingsToRow(settings: ProjectSettings): ProjectSettingsRow {
  return {
    project_id: settings.projectId,
    requirements_json: jsonText(settings.requirements),
    mode: settings.mode,
    roles_json: jsonText(settings.roles),
    missing_criteria: settings.missingCriteria,
    ci_key_hash: settings.ciKeyHash,
    require_children: toSqlBoolean(settings.requireChildren),
    language: settings.language,
    updated_at: toTimestamp(settings.updatedAt),
  };
}

function isStrength(value: string): value is Strength {
  return (STRENGTHS as readonly string[]).includes(value);
}

/**
 * Une exigence par type de critère (SPEC §9.2). Toute valeur absente ou
 * illisible reprend celle de la grille par défaut : un projet dont la grille
 * est corrompue garde les exigences du SPEC, pas une grille permissive.
 */
export function parseRequirement(raw: unknown, fallback: Requirement): Requirement {
  if (!isObject(raw)) return fallback;
  const accepted = parseStringList(raw['accepted']).filter(isStrength);
  return {
    accepted: accepted.length > 0 ? accepted : fallback.accepted,
    attesterRole:
      typeof raw['attesterRole'] === 'string' ? raw['attesterRole'] : fallback.attesterRole,
    notAuthor: typeof raw['notAuthor'] === 'boolean' ? raw['notAuthor'] : fallback.notAuthor,
    measurementLink:
      typeof raw['measurementLink'] === 'boolean'
        ? raw['measurementLink']
        : fallback.measurementLink,
    minDistinctTypes: toNumber(raw['minDistinctTypes'], fallback.minDistinctTypes),
    minor: typeof raw['minor'] === 'boolean' ? raw['minor'] : fallback.minor,
  };
}

/** La grille complète : toujours sept entrées, une par type de critère. */
export function parseRequirementGrid(raw: unknown): RequirementGrid {
  const source = isObject(raw) ? raw : parseJson<Record<string, unknown>>(raw, {}, isObject);
  const grid = {} as Record<CriterionType, Requirement>;
  for (const type of CRITERION_TYPES) {
    grid[type] = parseRequirement(source[type], DEFAULT_REQUIREMENTS[type]);
  }
  return grid;
}

function parseRoleList(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return parseStringList(value);
}

/**
 * Les rôles qui attestent et qui dérogent (SPEC §9.4, §12.4). Une liste vide
 * est un réglage réel (« personne »), une liste absente ou corrompue reprend
 * le défaut.
 */
export function parseRolePolicy(raw: unknown): RolePolicy {
  const source = isObject(raw) ? raw : parseJson<Record<string, unknown>>(raw, {}, isObject);
  return {
    attest: parseRoleList(source['attest'], DEFAULT_ROLES.attest),
    waive: parseRoleList(source['waive'], DEFAULT_ROLES.waive),
    security: parseRoleList(source['security'], DEFAULT_ROLES.security),
    data: parseRoleList(source['data'], DEFAULT_ROLES.data),
  };
}

/** Lit les réglages d'un projet. Langue illisible → `en` (soumission, §20). */
export function parseProjectSettingsValue(raw: unknown): ProjectSettings {
  const source = isObject(raw) ? raw : {};
  return {
    projectId: text(source['projectId']),
    requirements: parseRequirementGrid(source['requirements']),
    mode: parseEnum(source['mode'], GATE_MODES, 'strict'),
    roles: parseRolePolicy(source['roles']),
    missingCriteria: parseEnum(source['missingCriteria'], MISSING_CRITERIA_POLICIES, 'block'),
    ciKeyHash: text(source['ciKeyHash']),
    requireChildren: fromSqlBoolean(source['requireChildren']),
    language: parseEnum(source['language'], LANGUAGES, 'en'),
    updatedAt: fromTimestamp(source['updatedAt']),
  };
}

export function rowToProjectSettings(row: ProjectSettingsRow): ProjectSettings {
  return parseProjectSettingsValue({
    projectId: row.project_id,
    requirements: row.requirements_json,
    mode: row.mode,
    roles: row.roles_json,
    missingCriteria: row.missing_criteria,
    ciKeyHash: row.ci_key_hash,
    requireChildren: row.require_children,
    language: row.language,
    updatedAt: row.updated_at,
  });
}
