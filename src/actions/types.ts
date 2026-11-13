/**
 * Types des actions Rovo / MCP du lot L5 (SPEC §15).
 *
 * `ActionError` (erreur métier lisible par l'agent appelant) et les formes de
 * retour des sept outils. Les entrées brutes arrivent en `Record<string,
 * unknown>` (payload Forge) et sont validées par `dispatch.ts` puis par
 * chaque outil — SPEC §19 : chaînes, entiers, nombres, booléens seulement,
 * les listes passent en chaînes séparées par des virgules.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  BlockingItem,
  CriterionStatus,
  CriterionType,
  EvidenceType,
  Strength,
} from '../types';

/** Erreur métier d'une action : message lisible par l'agent qui appelle. */
export class ActionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ActionError';
  }
}

/* ------------------------------------------------------------------ sorties */

/** Une ligne de `list-criteria` (SPEC §8.1, §15). */
export interface CriterionSummary {
  id: string;
  code: string;
  text: string;
  type: CriterionType;
  requiredStrength: Strength;
  status: CriterionStatus;
  version: number;
}

export interface ListCriteriaResult {
  issueKey: string;
  total: number;
  criteria: readonly CriterionSummary[];
  /** Texte utile à un agent : ce que le ticket exige (SPEC §15, exigence 7). */
  text: string;
}

/** Couverture + critères en défaut, mêmes données que le validateur (§22.10). */
export interface GetProofStatusResult {
  issueKey: string;
  total: number;
  proven: number;
  waived: number;
  passes: boolean;
  blocking: readonly BlockingItem[];
  text: string;
}

export interface AttachEvidenceResult {
  evidenceId: string;
  criterionId: string;
  criterionCode: string;
  type: EvidenceType;
  /** Force calculée par l'app : `declared` pour une déclaration (SPEC §9.1). */
  strength: Strength;
  addedByAgent: boolean;
  text: string;
}

/** Une proposition de critère, en attente de validation humaine (SPEC §8.3). */
export interface ProposedCriterionItem {
  id: string;
  code: string;
  text: string;
  status: 'proposed';
}

export interface ProposeCriteriaResult {
  issueKey: string;
  proposedCount: number;
  criteria: readonly ProposedCriterionItem[];
  text: string;
}

/** Demande adressée au rôle compétent — jamais une attestation (SPEC §9.4). */
export interface RequestAttestationResult {
  issueKey: string;
  criterionId: string;
  criterionCode: string;
  /** Rôle compétent d'après la grille du projet (SPEC §9.2). */
  role: string;
  /** Ce que l'attestant devra vérifier, tel que fourni par l'appelant. */
  what: string;
  recipientCount: number;
  notified: boolean;
  text: string;
}

export interface SuggestedPairItem {
  criterionId: string;
  testName: string;
  confidence: number;
  rationale: string;
}

/** Paires proposées : jamais une preuve avant confirmation humaine (SPEC §11). */
export interface SuggestEvidenceResult {
  issueKey: string;
  suggestions: readonly SuggestedPairItem[];
  text: string;
}

export interface ReleaseIssueItem {
  issueKey: string;
  summary: string;
  total: number;
  proven: number;
  waived: number;
  waiverReasons: readonly string[];
}

/** Critère livré qui n'est plus prouvé (SPEC §13). */
export interface UnprovenDeliveredItem {
  issueKey: string;
  criterionCode: string;
  criterionText: string;
}

export interface ReleaseProofResult {
  versionId: string;
  versionName: string;
  projectKey: string;
  issuesCount: number;
  criteriaCount: number;
  provenCount: number;
  waivedCount: number;
  unprovenDeliveredCount: number;
  issues: readonly ReleaseIssueItem[];
  unprovenDelivered: readonly UnprovenDeliveredItem[];
  text: string;
}
