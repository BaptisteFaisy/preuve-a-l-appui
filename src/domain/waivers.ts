/**
 * Dérogations motivées au niveau critère (SPEC §12.4, FP-09).
 *
 * Principes stricts (SPEC §12.4, §20) :
 * - Dérogation critère par critère (jamais d'héritage d'un critère à l'autre) ;
 * - Motif obligatoire ;
 * - Rôle vérifié (parmi les rôles autorisés par le projet) ;
 * - Révocable mais jamais supprimée (intégrité) ;
 * - Compteur par personne et par projet.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { GranterCount, RolePolicy, Waiver } from '../types.js';

/** Vrai si la dérogation est actuellement valide (non révoquée et non expirée). */
export function isWaiverValid(waiver: Waiver, now: string): boolean {
  if (waiver.revokedAt !== '') return false;
  if (waiver.reason.trim().length === 0) return false;
  if (waiver.expiresAt !== '' && waiver.expiresAt <= now) return false;
  return true;
}

/** Vrai si la dérogation s'applique au critère spécifié et est active. */
export function isWaiverApplicable(waiver: Waiver, criterionId: string, now: string): boolean {
  return waiver.criterionId === criterionId && isWaiverValid(waiver, now);
}

/**
 * Recherche une dérogation active pour un critère donné.
 * Règle du SPEC §12.4 : une dérogation ne s'hérite jamais d'un critère à l'autre.
 */
export function findActiveWaiver(
  criterionId: string,
  waivers: readonly Waiver[],
  now: string,
): Waiver | null {
  for (const waiver of waivers) {
    if (isWaiverApplicable(waiver, criterionId, now)) {
      return waiver;
    }
  }
  return null;
}

/** Vrai si au moins un des rôles de l'acteur est autorisé à déroger. */
export function isRoleAllowedToWaive(
  actorRoles: readonly string[],
  rolesPolicy: RolePolicy,
): boolean {
  const allowed = new Set(rolesPolicy.waive);
  return actorRoles.some((role) => allowed.has(role));
}

/** Valide qu'une nouvelle dérogation respecte les règles avant enregistrement. */
export function validateWaiverCandidate(params: {
  criterionId: string;
  grantedBy: string;
  role: string;
  reason: string;
  /** Un agent ne peut jamais déroger (SPEC §15, §22 point 11). */
  actorIsAgent?: boolean;
  actorRoles: readonly string[];
  rolesPolicy: RolePolicy;
}): { valid: boolean; error?: string } {
  if (params.actorIsAgent === true) {
    return { valid: false, error: 'An agent can never grant a waiver' };
  }
  if (params.criterionId.trim().length === 0) {
    return { valid: false, error: 'Criterion ID is required' };
  }
  if (params.reason.trim().length === 0) {
    return { valid: false, error: 'Reason is required for a waiver' };
  }
  if (!isRoleAllowedToWaive(params.actorRoles, params.rolesPolicy)) {
    return { valid: false, error: 'Actor does not possess an authorized role to grant waivers' };
  }
  return { valid: true };
}

/** Calcule le nombre de dérogations accordées par personne (SPEC §12.4). */
export function countWaiversByGranter(waivers: readonly Waiver[]): GranterCount[] {
  const tallies = new Map<string, number>();
  for (const waiver of waivers) {
    if (waiver.revokedAt !== '') continue;
    const current = tallies.get(waiver.grantedBy) ?? 0;
    tallies.set(waiver.grantedBy, current + 1);
  }
  const result: GranterCount[] = [];
  for (const [accountId, count] of tallies.entries()) {
    result.push({ accountId, displayName: accountId, count });
  }
  return result.sort((a, b) => b.count - a.count || a.accountId.localeCompare(b.accountId));
}
