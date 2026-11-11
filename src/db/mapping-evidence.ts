/**
 * Mapping des preuves, attestations et dérogations (SPEC §9, §12.4, §18).
 *
 * Trois règles du SPEC se voient directement dans ces lignes :
 * - la force d'une preuve est *calculée* par l'app, jamais déclarée (§9.1) :
 *   la colonne `strength` n'est qu'un cache du dernier calcul ;
 * - une preuve n'est jamais supprimée (§20) : `replaced_by` pointe vers la
 *   preuve qui la remplace, vide tant qu'elle est la dernière ;
 * - une dérogation n'est jamais supprimée non plus (§12.4) : `revoked_at`
 *   vide = toujours active, `expires_at` vide = « jusqu'à la clôture ».
 *
 * Un seul parseur par type, utilisé par la lecture d'une ligne et par la
 * lecture d'une charge utile JSON (les preuves et les dérogations sont
 * aussi stockées à l'intérieur de `criteria_json` et du dossier).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Attestation, Evidence, Waiver } from '../types.js';
import {
  EVIDENCE_TYPES,
  FRESHNESS_VALUES,
  STRENGTHS,
  fromSqlBoolean,
  fromTimestamp,
  isObject,
  parseEnum,
  text,
  toNumber,
  toSqlBoolean,
  toTimestamp,
} from './mapping-common.js';

/* ----------------------------------------------------------------- evidence */

/** Une ligne de `evidence`, telle que Forge la rend (BOOLEAN en 0/1). */
export interface EvidenceRow {
  id: string;
  criterion_id: string;
  criterion_version: number;
  type: string;
  reference: string;
  note: string;
  strength: string;
  commit: string;
  freshness: string;
  verified: number | boolean;
  added_by: string;
  added_by_agent: number | boolean;
  at: string;
  replaced_by: string;
}

export const EVIDENCE_COLUMNS = [
  'id',
  'criterion_id',
  'criterion_version',
  'type',
  'reference',
  'note',
  'strength',
  'commit',
  'freshness',
  'verified',
  'added_by',
  'added_by_agent',
  'at',
  'replaced_by',
] as const satisfies readonly (keyof EvidenceRow)[];

export function evidenceToRow(evidence: Evidence): EvidenceRow {
  return {
    id: evidence.id,
    criterion_id: evidence.criterionId,
    criterion_version: evidence.criterionVersion,
    type: evidence.type,
    reference: evidence.reference,
    note: evidence.note,
    strength: evidence.strength,
    commit: evidence.commit,
    freshness: evidence.freshness,
    verified: toSqlBoolean(evidence.verified),
    added_by: evidence.addedBy,
    added_by_agent: toSqlBoolean(evidence.addedByAgent),
    at: toTimestamp(evidence.at),
    replaced_by: evidence.replacedBy,
  };
}

/**
 * Lit une preuve. Type inconnu → `link`, force inconnue → `declared`,
 * fraîcheur illisible → `stale` : une preuve dont on ne peut pas lire l'état
 * ne compte jamais comme fraîche.
 */
export function parseEvidenceValue(raw: unknown): Evidence {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    criterionId: text(source['criterionId']),
    criterionVersion: toNumber(source['criterionVersion']),
    type: parseEnum(source['type'], EVIDENCE_TYPES, 'link'),
    reference: text(source['reference']),
    note: text(source['note']),
    strength: parseEnum(source['strength'], STRENGTHS, 'declared'),
    commit: text(source['commit']),
    freshness: parseEnum(source['freshness'], FRESHNESS_VALUES, 'stale'),
    verified: fromSqlBoolean(source['verified']),
    addedBy: text(source['addedBy']),
    addedByAgent: fromSqlBoolean(source['addedByAgent']),
    at: fromTimestamp(source['at']),
    replacedBy: text(source['replacedBy']),
  };
}

export function rowToEvidence(row: EvidenceRow): Evidence {
  return parseEvidenceValue({
    id: row.id,
    criterionId: row.criterion_id,
    criterionVersion: row.criterion_version,
    type: row.type,
    reference: row.reference,
    note: row.note,
    strength: row.strength,
    commit: row.commit,
    freshness: row.freshness,
    verified: row.verified,
    addedBy: row.added_by,
    addedByAgent: row.added_by_agent,
    at: row.at,
    replacedBy: row.replaced_by,
  });
}

/* ------------------------------------------------------------- attestation */

/** Une ligne de `attestation`, telle que Forge la rend. */
export interface AttestationRow {
  id: string;
  criterion_id: string;
  evidence_id: string;
  attester_account_id: string;
  role: string;
  note: string;
  attachment_ref: string;
  at: string;
}

export const ATTESTATION_COLUMNS = [
  'id',
  'criterion_id',
  'evidence_id',
  'attester_account_id',
  'role',
  'note',
  'attachment_ref',
  'at',
] as const satisfies readonly (keyof AttestationRow)[];

export function attestationToRow(attestation: Attestation): AttestationRow {
  return {
    id: attestation.id,
    criterion_id: attestation.criterionId,
    evidence_id: attestation.evidenceId,
    attester_account_id: attestation.attesterAccountId,
    role: attestation.role,
    note: attestation.note,
    attachment_ref: attestation.attachmentRef,
    at: toTimestamp(attestation.at),
  };
}

/**
 * Lit une attestation. L'indépendance (l'attestant n'est ni l'auteur ni un
 * agent, SPEC §9.4) est vérifiée par le domaine, pas ici : ce parseur ne fait
 * que restituer ce qui a été signé.
 */
export function parseAttestationValue(raw: unknown): Attestation {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    criterionId: text(source['criterionId']),
    evidenceId: text(source['evidenceId']),
    attesterAccountId: text(source['attesterAccountId']),
    role: text(source['role']),
    note: text(source['note']),
    attachmentRef: text(source['attachmentRef']),
    at: fromTimestamp(source['at']),
  };
}

export function rowToAttestation(row: AttestationRow): Attestation {
  return parseAttestationValue({
    id: row.id,
    criterionId: row.criterion_id,
    evidenceId: row.evidence_id,
    attesterAccountId: row.attester_account_id,
    role: row.role,
    note: row.note,
    attachmentRef: row.attachment_ref,
    at: row.at,
  });
}

/* ------------------------------------------------------------------ waiver */

/** Une ligne de `waiver`, telle que Forge la rend. */
export interface WaiverRow {
  id: string;
  criterion_id: string;
  granted_by: string;
  role: string;
  reason: string;
  at: string;
  expires_at: string;
  revoked_at: string;
}

export const WAIVER_COLUMNS = [
  'id',
  'criterion_id',
  'granted_by',
  'role',
  'reason',
  'at',
  'expires_at',
  'revoked_at',
] as const satisfies readonly (keyof WaiverRow)[];

export function waiverToRow(waiver: Waiver): WaiverRow {
  return {
    id: waiver.id,
    criterion_id: waiver.criterionId,
    granted_by: waiver.grantedBy,
    role: waiver.role,
    reason: waiver.reason,
    at: toTimestamp(waiver.at),
    expires_at: toTimestamp(waiver.expiresAt),
    revoked_at: toTimestamp(waiver.revokedAt),
  };
}

/**
 * Lit une dérogation. `expiresAt` et `revokedAt` vides veulent dire quelque
 * chose (« jusqu'à la clôture », « toujours active ») : le vide est conservé
 * tel quel, jamais converti en `null`.
 */
export function parseWaiverValue(raw: unknown): Waiver {
  const source = isObject(raw) ? raw : {};
  return {
    id: text(source['id']),
    criterionId: text(source['criterionId']),
    grantedBy: text(source['grantedBy']),
    role: text(source['role']),
    reason: text(source['reason']),
    at: fromTimestamp(source['at']),
    expiresAt: fromTimestamp(source['expiresAt']),
    revokedAt: fromTimestamp(source['revokedAt']),
  };
}

export function rowToWaiver(row: WaiverRow): Waiver {
  return parseWaiverValue({
    id: row.id,
    criterionId: row.criterion_id,
    grantedBy: row.granted_by,
    role: row.role,
    reason: row.reason,
    at: row.at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  });
}
