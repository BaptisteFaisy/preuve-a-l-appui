/**
 * Mapping des critères et de leur historique (SPEC §8, §18).
 *
 * Un critère est identifié par `id` et porte un `code` stable (`AC-1`) ;
 * le texte peut changer, la version incrémente, l'ancienne reste dans
 * `criterion_history` (SPEC §8.4). Les preuves de la version précédente
 * passent en « à revoir » — c'est le domaine qui le décide, pas la base.
 *
 * Un seul parseur par type (`parseCriterionValue`) sert à la lecture d'une
 * ligne SQL et à la lecture d'une charge utile JSON : la règle de repli est
 * écrite une fois, la ligne et le JSON ne peuvent pas diverger.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Criterion, CriterionRevision } from '../types';
import {
  CRITERION_STATUSES,
  CRITERION_TYPES,
  STRENGTHS,
  fromTimestamp,
  parseEnum,
  text,
  toNumber,
  toTimestamp,
} from './mapping-common';
import { isObject } from './mapping-common';

/** Une ligne de `criterion`, telle que Forge la rend. */
export interface CriterionRow {
  id: string;
  issue_id: string;
  code: string;
  text: string;
  type: string;
  required_strength: string;
  version: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Une ligne de `criterion_history`, telle que Forge la rend. */
export interface CriterionRevisionRow {
  criterion_id: string;
  version: number;
  text: string;
  type: string;
  changed_by: string;
  at: string;
}

export const CRITERION_COLUMNS = [
  'id',
  'issue_id',
  'code',
  'text',
  'type',
  'required_strength',
  'version',
  'status',
  'created_by',
  'created_at',
  'updated_at',
] as const satisfies readonly (keyof CriterionRow)[];

export const CRITERION_HISTORY_COLUMNS = [
  'criterion_id',
  'version',
  'text',
  'type',
  'changed_by',
  'at',
] as const satisfies readonly (keyof CriterionRevisionRow)[];

/** Écrit la ligne d'un critère ; les dates partent au format Forge SQL. */
export function criterionToRow(criterion: Criterion): CriterionRow {
  return {
    id: criterion.id,
    issue_id: criterion.issueId,
    code: criterion.code,
    text: criterion.text,
    type: criterion.type,
    required_strength: criterion.requiredStrength,
    version: criterion.version,
    status: criterion.status,
    created_by: criterion.createdBy,
    created_at: toTimestamp(criterion.createdAt),
    updated_at: toTimestamp(criterion.updatedAt),
  };
}

/**
 * Lit un critère. Type inconnu → `functional`, force inconnue → `declared`,
 * statut inconnu → `proposed` : un critère illisible ne devient jamais actif
 * tout seul.
 */
export function parseCriterionValue(raw: unknown): Criterion {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    issueId: text(source['issueId']),
    code: text(source['code']),
    text: text(source['text']),
    type: parseEnum(source['type'], CRITERION_TYPES, 'functional'),
    requiredStrength: parseEnum(source['requiredStrength'], STRENGTHS, 'declared'),
    version: toNumber(source['version']),
    status: parseEnum(source['status'], CRITERION_STATUSES, 'proposed'),
    createdBy: text(source['createdBy']),
    createdAt: fromTimestamp(source['createdAt']),
    updatedAt: fromTimestamp(source['updatedAt']),
  };
}

/** Relit une ligne `criterion` — même repli que pour une charge utile JSON. */
export function rowToCriterion(row: CriterionRow): Criterion {
  return parseCriterionValue({
    id: row.id,
    issueId: row.issue_id,
    code: row.code,
    text: row.text,
    type: row.type,
    requiredStrength: row.required_strength,
    version: row.version,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Écrit la ligne d'une révision de critère. */
export function criterionRevisionToRow(revision: CriterionRevision): CriterionRevisionRow {
  return {
    criterion_id: revision.criterionId,
    version: revision.version,
    text: revision.text,
    type: revision.type,
    changed_by: revision.changedBy,
    at: toTimestamp(revision.at),
  };
}

/** Lit une révision de critère. */
export function parseCriterionRevisionValue(raw: unknown): CriterionRevision {
  const source = isObject(raw) ? raw : {};
  return {
    criterionId: text(source['criterionId']),
    version: toNumber(source['version']),
    text: text(source['text']),
    type: parseEnum(source['type'], CRITERION_TYPES, 'functional'),
    changedBy: text(source['changedBy']),
    at: fromTimestamp(source['at']),
  };
}

/** Relit une ligne `criterion_history`. */
export function rowToCriterionRevision(row: CriterionRevisionRow): CriterionRevision {
  return parseCriterionRevisionValue({
    criterionId: row.criterion_id,
    version: row.version,
    text: row.text,
    type: row.type,
    changedBy: row.changed_by,
    at: row.at,
  });
}
