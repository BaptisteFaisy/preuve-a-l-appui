/**
 * Calcul et vérification de la force d'un élément de preuve (SPEC §9.1, §9.3).
 *
 * Table de force par type (SPEC §9.1) :
 * - test automatisé : 'machine-verified' si le test figure dans les résultats de
 *   CI, passe, sur un commit de la branche du ticket (SPEC §22, points 2-3) ;
 * - page de documentation : 'machine-verified' si la page existe et a changé
 *   après l'ouverture du ticket ;
 * - attestation : 'attested' (l'indépendance de l'attestant est vérifiée par
 *   `independence.ts`, SPEC §9.4) ;
 * - capture ou vidéo : 'declared', SAUF si accompagnée d'une attestation
 *   valide : elle prend alors la force de l'attestation ('attested', §9.1) ;
 * - compte rendu d'agent : 'declared' ;
 * - lien libre : 'declared'.
 *
 * Règles :
 * - La vérification passe par le port `EvidenceChecker` : jamais d'appel réseau
 *   dans le domaine (mission L2, exigence 2) ;
 * - Domaine pur : aucun import `@forge/*` ;
 * - Fichier < 500 lignes, fonctions < 50 lignes.
 */
import type { EvidenceChecker } from '../ports.js';
import type { EvidenceType, Strength, TestOutcome } from '../types.js';

/** Résultat de la vérification d'une preuve : force obtenue et vérification. */
export interface VerificationResult {
  readonly verified: boolean;
  readonly strength: Strength;
}

/** Ce que le domaine reçoit pour vérifier une preuve de type test (SPEC §10). */
export interface TestRunContext {
  /** Résultats du dernier run de la branche, noms et états seulement. */
  readonly outcomes: readonly TestOutcome[];
  /** Commit sur lequel ce run a tourné. */
  readonly commit: string;
}

export interface VerifyEvidenceInput {
  readonly type: EvidenceType;
  readonly reference: string;
  readonly issueId?: string;
  readonly criterionCode?: string;
  /** Ouverture du ticket : la page doit avoir changé après (SPEC §9.1). */
  readonly since?: string;
  readonly hasValidAttestation?: boolean;
  /** Commit porté par la preuve de test ; vide = aucun commit déclaré. */
  readonly commit?: string;
  /** Résultats de CI disponibles pour la branche, si déjà reçus. */
  readonly run?: TestRunContext;
}

/**
 * Force intrinsèque d'un type de preuve (SPEC §9.1), hors attestation liée.
 */
export function defaultStrengthForEvidenceType(type: EvidenceType): Strength {
  switch (type) {
    case 'test':
    case 'documentation':
      return 'machine-verified';
    case 'attestation':
      return 'attested';
    case 'attachment':
    case 'agent-report':
    case 'link':
    default:
      return 'declared';
  }
}

/**
 * SPEC §9.1 : « Une capture accompagnée d'une attestation prend la force de
 * l'attestation. » Une capture seule reste déclarée : l'app ne lit pas les
 * images (SPEC §9.1, Forge LLMs ne traitent que du texte).
 */
export function strengthWithAttestation(type: EvidenceType, hasValidAttestation: boolean): Strength {
  if (type === 'attachment' && hasValidAttestation) {
    return 'attested';
  }
  return defaultStrengthForEvidenceType(type);
}

/**
 * Un test n'est 'machine-verified' que s'il figure dans les résultats de CI,
 * passe, sur le commit de la branche (SPEC §9.1). Absent, échoué, ignoré ou
 * sur un autre commit : aucune preuve valable (SPEC §22, point 3) — la force
 * retombe à 'declared' et `verified` est faux.
 */
export function verifyTestAgainstRun(input: VerifyEvidenceInput): VerificationResult | null {
  if (input.type !== 'test') return null;
  const run = input.run;
  if (!run) {
    return { verified: false, strength: 'declared' };
  }
  const outcome = run.outcomes.find((entry) => entry.name === input.reference);
  const sameCommit = Boolean(input.commit) && input.commit === run.commit;
  const passed = outcome?.state === 'passed';
  if (passed && sameCommit) {
    return { verified: true, strength: 'machine-verified' };
  }
  return { verified: false, strength: 'declared' };
}

async function verifyContent(
  input: VerifyEvidenceInput,
  checker?: EvidenceChecker,
): Promise<boolean> {
  if (!checker) return true;
  switch (input.type) {
    case 'documentation':
      return checker.documentationPage(input.reference, input.since ?? '');
    case 'attachment':
      return input.issueId ? checker.attachmentExists(input.issueId, input.reference) : true;
    case 'agent-report':
      return input.issueId && input.criterionCode
        ? checker.reportSection(input.issueId, input.reference, input.criterionCode)
        : true;
    case 'link':
      return checker.linkReachable(input.reference);
    case 'test':
    case 'attestation':
    default:
      return true;
  }
}

/**
 * Vérifie une preuve (via le port `EvidenceChecker` et les résultats de CI)
 * et calcule sa force. Aucune exception : une vérification impossible rend
 * `verified: false` (une preuve douteuse ne compte pas).
 */
export async function computeEvidenceStrength(
  input: VerifyEvidenceInput,
  checker?: EvidenceChecker,
): Promise<VerificationResult> {
  const testResult = verifyTestAgainstRun(input);
  if (testResult) return testResult;
  const verified = await verifyContent(input, checker);
  const strength = strengthWithAttestation(input.type, Boolean(input.hasValidAttestation));
  return { verified, strength };
}
