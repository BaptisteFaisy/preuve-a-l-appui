/**
 * Qui peut attester ? Indépendance de l'attestation (SPEC §9.4, §21, FP-08).
 *
 * Règles, dans l'ordre de vérification :
 * 1. Un agent ne peut jamais attester : tout appel MCP est marqué agent et ne
 *    peut que déclarer (SPEC §9.4, §19) ;
 * 2. L'assigné du ticket ne peut pas attester ses propres critères, et un
 *    ancien assigné ne peut toujours pas attester le travail qu'il a fait
 *    (SPEC §9.4, §21) ;
 * 3. Quand l'exigence demande un attestant autre que l'auteur (données,
 *    migration, SPEC §9.2), l'auteur du travail est refusé ;
 * 4. Pour les types Sécurité et Données, l'attestant doit porter le rôle de
 *    projet désigné : `settings.roles.security` / `settings.roles.data`,
 *    ou `requirement.attesterRole` si la grille le nomme (SPEC §9.4) ;
 * 5. Le projet peut restreindre l'attestation à certains rôles
 *    (`settings.roles.attest`, SPEC §16.3).
 *
 * La raison du refus est traduite (anglais + français, SPEC §20) via
 * `src/i18n/evidence.ts`. Domaine pur : aucun import `@forge/*`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Actor, Criterion, IssueRef, Language, ProjectSettings, Requirement } from '../types';
import { text } from '../i18n/index';
import { EVIDENCE_MESSAGES } from '../i18n/evidence';

/** Verdict d'indépendance : autorisé ou non, avec la raison traduite. */
export interface AttestVerdict {
  readonly allowed: boolean;
  readonly reason: string;
}

/** Contexte optionnel : anciens assignés (SPEC §21) et auteur du travail. */
export interface AttestContext {
  /** Comptes ayant été assignés au ticket avant l'assigné actuel. */
  readonly formerAssignees?: readonly string[];
  /** Auteur du travail prouvé (défaut : l'assigné actuel du ticket). */
  readonly authorAccountId?: string;
}

function refuse(key: string, lang: Language, vars?: { role: string }): AttestVerdict {
  return { allowed: false, reason: text(EVIDENCE_MESSAGES, key, lang, vars ?? {}) };
}

function allow(lang: Language): AttestVerdict {
  return { allowed: true, reason: text(EVIDENCE_MESSAGES, 'independence.allowed', lang) };
}

/** Rôles désignés par le projet pour les types Sécurité et Données (SPEC §9.4). */
export function designatedRoles(settings: ProjectSettings, criterion: Criterion): readonly string[] {
  if (criterion.type === 'security') return settings.roles.security;
  if (criterion.type === 'data') return settings.roles.data;
  return [];
}

/** L'acteur porte-t-il l'un des rôles ? Liste vide = aucune exigence de rôle. */
function holdsAnyRole(actor: Actor, roles: readonly string[]): boolean {
  if (roles.length === 0) return true;
  return roles.some((role) => actor.roles.includes(role));
}

function checkAssignees(
  actor: Actor,
  issue: IssueRef,
  requirement: Requirement | undefined,
  lang: Language,
  context?: AttestContext,
): AttestVerdict | null {
  const account = actor.accountId;
  if (account !== '' && account === issue.assigneeAccountId) {
    return refuse('independence.refused.assignee', lang);
  }
  if (context?.formerAssignees?.includes(account)) {
    return refuse('independence.refused.former_assignee', lang);
  }
  const author = context?.authorAccountId ?? issue.assigneeAccountId;
  if (requirement?.notAuthor && author !== '' && account === author) {
    return refuse('independence.refused.author', lang);
  }
  return null;
}

function checkRoles(
  actor: Actor,
  settings: ProjectSettings,
  criterion: Criterion,
  lang: Language,
): AttestVerdict | null {
  const requirement = settings.requirements[criterion.type];
  const requiredRole = requirement?.attesterRole ?? '';
  if (requiredRole !== '' && !actor.roles.includes(requiredRole)) {
    return refuse('independence.refused.missing_role', lang, { role: requiredRole });
  }
  const designated = designatedRoles(settings, criterion);
  if (designated.length > 0) {
    // SPEC §9.4 : pour Sécurité et Données, le rôle désigné *est* l'habilité —
    // le porter suffit, même hors de la liste générale `roles.attest`.
    if (!holdsAnyRole(actor, designated)) {
      return refuse('independence.refused.missing_role', lang, { role: designated.join(', ') });
    }
    return null;
  }
  if (!holdsAnyRole(actor, settings.roles.attest)) {
    return refuse('independence.refused.not_attester', lang);
  }
  return null;
}

/**
 * Un acteur peut-il attester ce critère, sur ce ticket, dans ce projet ?
 * Signature du brief L2 : `canAttest(actor, issue, criterion, settings)` ;
 * le cinquième paramètre (contexte) porte les cas limites du SPEC §21.
 */
export function canAttest(
  actor: Actor,
  issue: IssueRef,
  criterion: Criterion,
  settings: ProjectSettings,
  context?: AttestContext,
): AttestVerdict {
  const lang = settings.language;
  if (actor.agent) {
    return refuse('independence.refused.agent', lang);
  }
  const requirement = settings.requirements[criterion.type];
  const assigneeFail = checkAssignees(actor, issue, requirement, lang, context);
  if (assigneeFail) return assigneeFail;
  const roleFail = checkRoles(actor, settings, criterion, lang);
  if (roleFail) return roleFail;
  return allow(lang);
}
