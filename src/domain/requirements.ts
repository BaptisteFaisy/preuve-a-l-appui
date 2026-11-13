/**
 * Résolution de l'exigence de preuve (SPEC §9.2, §8.1, §12.1, FP-05).
 *
 * La grille d'exigences se résout en trois couches, dans cet ordre :
 * 1. `settings.requirements[type]` — la grille du projet, une entrée par type
 *    de critère (SPEC §9.2) ;
 * 2. la surcharge par critère — `criterion.requiredStrength` (SPEC §8.1 :
 *    « héritée du type, modifiable par critère ») ;
 * 3. `minDistinctTypes` — la preuve croisée (SPEC §9.2, lot C) : ici on pose
 *    seulement la **lecture** de l'exigence, pas son application.
 *
 * La phrase « preuve attendue » (SPEC §5 principe 5, §12.1) est traduite en
 * anglais et en français via `src/i18n/evidence.ts`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes. Domaine pur.
 */
import type { RequirementResolver } from '../ports';
import type {
  Criterion,
  CriterionType,
  EvidenceType,
  ProjectSettings,
  Requirement,
  Strength,
} from '../types';
import { text } from '../i18n/index';
import { EVIDENCE_MESSAGES } from '../i18n/evidence';

/** Exigence neutre de repli si la grille du projet ne couvre pas un type. */
export const FALLBACK_REQUIREMENT: Requirement = {
  accepted: ['attested'],
  attesterRole: '',
  notAuthor: false,
  measurementLink: false,
  minDistinctTypes: 1,
  minor: false,
};

/** Toutes les forces qui atteignent `required`, de la plus forte à la plus faible. */
function acceptedFrom(required: Strength): readonly Strength[] {
  if (required === 'machine-verified') return ['machine-verified'];
  if (required === 'attested') return ['machine-verified', 'attested'];
  return ['machine-verified', 'attested', 'declared'];
}

/**
 * Exigence pour un type de critère : l'entrée de la grille du projet
 * (SPEC §9.2), ou le repli neutre si le type n'y figure pas.
 */
export function resolveRequirementForType(
  settings: ProjectSettings,
  type: CriterionType,
): Requirement {
  return settings.requirements[type] ?? FALLBACK_REQUIREMENT;
}

/**
 * Exigence pour un critère : la grille du projet, avec la surcharge par
 * critère (`criterion.requiredStrength`, SPEC §8.1). La force exigée d'un
 * critère est *héritée du type* à la création : tant qu'elle égale la force
 * primaire de la grille (`accepted[0]`), c'est la liste du projet qui fait
 * foi (SPEC §9.2 : « Fonctionnel — vérifiée par machine, **ou** attestée »).
 * Une valeur différente est une surcharge explicite : la liste acceptée
 * devient toutes les forces qui atteignent cette exigence. Les autres règles
 * (rôle désigné, lien de mesure, preuve croisée) viennent toujours de la grille.
 */
export function resolveRequirement(settings: ProjectSettings, criterion: Criterion): Requirement {
  const base = resolveRequirementForType(settings, criterion.type);
  const inherited = base.accepted[0];
  const override = criterion.requiredStrength;
  if (!override || override === inherited) return base;
  return { ...base, accepted: acceptedFrom(override) };
}

/**
 * Lecture seule de l'exigence de preuve croisée (SPEC §9.2, lot C) :
 * vrai quand le projet demande plusieurs preuves de types différents.
 * L'application de cette exigence appartient au moteur de couverture (L3).
 */
export function requiresCrossEvidence(requirement: Requirement): boolean {
  return requirement.minDistinctTypes > 1;
}

function pickExpectedKey(criterion: Criterion, requirement: Requirement): string {
  if (criterion.type === 'security' && requirement.attesterRole) {
    return 'requirements.expected.security_attested';
  }
  if (criterion.type === 'data' && requirement.notAuthor) {
    return 'requirements.expected.data_attested';
  }
  if (criterion.type === 'performance' && requirement.measurementLink) {
    return 'requirements.expected.performance_attested';
  }
  const weakestAccepted = requirement.accepted[requirement.accepted.length - 1] ?? criterion.requiredStrength;
  if (weakestAccepted === 'machine-verified') return 'requirements.expected.machine-verified';
  if (weakestAccepted === 'attested') return 'requirements.expected.attested';
  return 'requirements.expected.declared';
}

/**
 * La phrase « preuve attendue » d'un critère, dans la langue du projet
 * (SPEC §7.2, §12.1). `evidenceType` est accepté pour signature conforme au
 * port ; la phrase dépend du critère et de sa grille, pas du type de preuve.
 */
export function resolveExpectedProof(
  settings: ProjectSettings,
  criterion: Criterion,
  _evidenceType?: EvidenceType,
): string {
  const requirement = resolveRequirement(settings, criterion);
  return text(EVIDENCE_MESSAGES, pickExpectedKey(criterion, requirement), settings.language);
}

/** Le port `RequirementResolver` (src/ports.ts), prêt à injecter. */
export function createRequirementResolver(): RequirementResolver {
  return {
    forType: resolveRequirementForType,
    forCriterion: resolveRequirement,
    expectedProof: resolveExpectedProof,
  };
}
