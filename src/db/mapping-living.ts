/**
 * Mapping de la preuve vivante et du dossier de preuve (SPEC §13, §17).
 *
 * La preuve vivante suit un critère *livré* : le test qui le garantissait
 * passe, échoue, ou disparaît. Le domaine n'a pas de `projectId` — c'est le
 * contexte d'écriture qui le fournit, comme `snapshotId` chez Rayon d'impact ;
 * la colonne existe quand même, parce que `listLivingByProject` filtre dessus.
 *
 * Le dossier est un instantané figé, écrit d'un bloc et relu d'un bloc :
 * `issues_json` et `totals_json` sont du TEXT. Une charge utile corrompue se
 * lit comme un dossier vide (écran vide) plutôt que comme une exception —
 * R4 §6.3.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DossierIssue, DossierTotals, LivingProof, ReleaseDossier } from '../types.js';
import {
  LIVING_STATES,
  fromTimestamp,
  isObject,
  jsonText,
  numberOrZero,
  parseEnum,
  parseJson,
  parseObjectList,
  text,
  toTimestamp,
} from './mapping-common.js';
import { parseCriterionStates } from './mapping-coverage.js';
import { parseWaiverValue } from './mapping-evidence.js';

/* ------------------------------------------------------------- living proof */

/** Une ligne de `living_proof`, telle que Forge la rend. */
export interface LivingProofRow {
  id: string;
  project_id: string;
  issue_key: string;
  criterion_id: string;
  test_name: string;
  state: string;
  component: string;
  commit: string;
  since: string;
}

export const LIVING_PROOF_COLUMNS = [
  'id',
  'project_id',
  'issue_key',
  'criterion_id',
  'test_name',
  'state',
  'component',
  'commit',
  'since',
] as const satisfies readonly (keyof LivingProofRow)[];

/**
 * Écrit la ligne d'une preuve vivante. `projectId` n'est pas un champ du
 * domaine : c'est le projet du ticket, connu du contexte d'écriture.
 */
export function livingProofToRow(proof: LivingProof, projectId: string): LivingProofRow {
  return {
    id: proof.id,
    project_id: projectId,
    issue_key: proof.issueKey,
    criterion_id: proof.criterionId,
    test_name: proof.testName,
    state: proof.state,
    component: proof.component,
    commit: proof.commit,
    since: toTimestamp(proof.since),
  };
}

/**
 * Lit une preuve vivante. État illisible → `unproven` : dans le doute, le
 * critère livré est affiché comme n'étant plus prouvé (SPEC §13), jamais
 * comme sain.
 */
export function parseLivingProofValue(raw: unknown): LivingProof {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    issueKey: text(source['issueKey']),
    criterionId: text(source['criterionId']),
    testName: text(source['testName']),
    state: parseEnum(source['state'], LIVING_STATES, 'unproven'),
    component: text(source['component']),
    commit: text(source['commit']),
    since: fromTimestamp(source['since']),
  };
}

export function rowToLivingProof(row: LivingProofRow): LivingProof {
  return parseLivingProofValue({
    id: row.id,
    issueKey: row.issue_key,
    criterionId: row.criterion_id,
    testName: row.test_name,
    state: row.state,
    component: row.component,
    commit: row.commit,
    since: row.since,
  });
}

/* ------------------------------------------------------------ release dossier */

/** Une ligne de `release_dossier`, telle que Forge la rend. */
export interface ReleaseDossierRow {
  version_id: string;
  version_name: string;
  project_key: string;
  generated_at: string;
  issues_json: string;
  totals_json: string;
}

export const RELEASE_DOSSIER_COLUMNS = [
  'version_id',
  'version_name',
  'project_key',
  'generated_at',
  'issues_json',
  'totals_json',
] as const satisfies readonly (keyof ReleaseDossierRow)[];

/** Un ticket du dossier ; sans clé de ticket, la ligne n'a pas de sens. */
export function parseDossierIssueValue(raw: unknown): DossierIssue | null {
  if (!isObject(raw)) return null;
  const issueKey = text(raw['issueKey']);
  if (issueKey.length === 0) return null;
  return {
    issueKey,
    summary: text(raw['summary']),
    total: numberOrZero(raw['total']),
    proven: numberOrZero(raw['proven']),
    waived: numberOrZero(raw['waived']),
    waivers: parseObjectList(raw['waivers']).map((item) => parseWaiverValue(item)),
    criteria: parseCriterionStates(raw['criteria']),
  };
}

/** Les tickets du dossier, depuis un tableau ou un TEXT. */
export function parseDossierIssues(raw: unknown): DossierIssue[] {
  return parseObjectList(raw).flatMap((item) => {
    const issue = parseDossierIssueValue(item);
    return issue ? [issue] : [];
  });
}

/** Les totaux du dossier : sept compteurs, jamais une estimation. */
export function parseDossierTotals(raw: unknown): DossierTotals {
  const source = isObject(raw) ? raw : parseJson<Record<string, unknown>>(raw, {}, isObject);
  return {
    issues: numberOrZero(source['issues']),
    criteria: numberOrZero(source['criteria']),
    proven: numberOrZero(source['proven']),
    machineVerified: numberOrZero(source['machineVerified']),
    attested: numberOrZero(source['attested']),
    declared: numberOrZero(source['declared']),
    waived: numberOrZero(source['waived']),
  };
}

export function releaseDossierToRow(dossier: ReleaseDossier): ReleaseDossierRow {
  return {
    version_id: dossier.versionId,
    version_name: dossier.versionName,
    project_key: dossier.projectKey,
    generated_at: toTimestamp(dossier.generatedAt),
    issues_json: jsonText(dossier.issues),
    totals_json: jsonText(dossier.totals),
  };
}

export function parseReleaseDossierValue(raw: unknown): ReleaseDossier {
  const source = isObject(raw) ? raw : {};
  return {
    versionId: text(source['versionId']),
    versionName: text(source['versionName']),
    projectKey: text(source['projectKey']),
    generatedAt: fromTimestamp(source['generatedAt']),
    issues: parseDossierIssues(source['issues']),
    totals: parseDossierTotals(source['totals']),
  };
}

export function rowToReleaseDossier(row: ReleaseDossierRow): ReleaseDossier {
  return parseReleaseDossierValue({
    versionId: row.version_id,
    versionName: row.version_name,
    projectKey: row.project_key,
    generatedAt: row.generated_at,
    issues: row.issues_json,
    totals: row.totals_json,
  });
}
