/**
 * Messages du lot critères (SPEC §8, §20) : types de critère, états, section
 * de description réécrite par l'app, et erreurs nommées.
 *
 * Toute chaîne visible par l'utilisateur passe par ce fichier, en anglais et
 * en français (docs/CONVENTIONS.md). Les clés sont en `domaine.point`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { CriterionStatus, CriterionType, Language } from '../types';
import type { MessageVars, Messages } from './index';
import { translate } from './index';

/** Dictionnaire du lot L1 : aucun autre lot n'y écrit. */
export const CRITERIA_MESSAGES: Messages = {
  /* Les sept types de critère (SPEC §8.1). */
  'criteria.type.functional': { en: 'Functional', fr: 'Fonctionnel' },
  'criteria.type.regression': { en: 'Regression', fr: 'Non-régression' },
  'criteria.type.performance': { en: 'Performance', fr: 'Performance' },
  'criteria.type.security': { en: 'Security', fr: 'Sécurité' },
  'criteria.type.accessibility': { en: 'Accessibility', fr: 'Accessibilité' },
  'criteria.type.data': { en: 'Data & migration', fr: 'Données & migration' },
  'criteria.type.documentation': { en: 'Documentation', fr: 'Documentation' },

  /* Les trois états d'un critère (SPEC §8.3). */
  'criteria.status.proposed': { en: 'Proposed', fr: 'Proposé' },
  'criteria.status.active': { en: 'Active', fr: 'Actif' },
  'criteria.status.superseded': { en: 'Superseded', fr: 'Remplacé' },

  /* La section réécrite dans la description (SPEC §8.2). */
  'criteria.section.title': { en: 'Acceptance criteria', fr: "Critères d'acceptation" },
  'criteria.section.empty': {
    en: 'No acceptance criterion yet: the app proposes them from the description, a human validates.',
    fr: "Aucun critère d'acceptation pour l'instant : l'app les propose depuis la description, un humain valide.",
  },
  'criteria.section.summary': {
    en: '{count} criterion/criteria held by the app "Done, with proof": a text change bumps the version and puts its proofs up for review. Validated by a human, never by an agent.',
    fr: "{count} critère(s) tenu(s) par l'app « Fait, preuve à l'appui » : un texte modifié incrémente la version et met ses preuves à revoir. Validé par un humain, jamais par un agent.",
  },

  /* Erreurs nommées : jamais « une erreur est survenue » (SPEC §5, principe 5). */
  'criteria.error.agentCannotValidate': {
    en: 'Criterion {code} cannot be validated by an agent: only a human validates acceptance criteria.',
    fr: "Le critère {code} ne peut pas être validé par un agent : seul un humain valide les critères d'acceptation.",
  },
  'criteria.error.alreadyActive': {
    en: 'Criterion {code} is already validated: nothing to do.',
    fr: 'Le critère {code} est déjà validé : rien à faire.',
  },
  'criteria.error.emptyText': {
    en: 'Criterion {code} cannot be saved with an empty text.',
    fr: 'Le critère {code} ne peut pas être enregistré avec un texte vide.',
  },
  'criteria.import.empty': {
    en: 'No acceptance criteria found in the description of {issueKey}.',
    fr: "Aucun critère d'acceptation trouvé dans la description de {issueKey}.",
  },
  'criteria.import.skipped': {
    en: '{count} criterion/criteria skipped: already held by the app.',
    fr: "{count} critère(s) ignoré(s) : déjà tenu(s) par l'app.",
  },
};

/** Traduit une clé du lot critères avec ses variables d'interpolation. */
export function criteriaMessage(
  key: string,
  language: Language,
  vars: MessageVars = {},
): string {
  return translate(CRITERIA_MESSAGES, key, language, vars).text;
}

/** Libellé d'un type de critère (SPEC §8.1), dans la langue du projet. */
export function criterionTypeLabel(type: CriterionType, language: Language): string {
  return criteriaMessage(`criteria.type.${type}`, language);
}

/** Libellé d'un état de critère (SPEC §8.3), dans la langue du projet. */
export function criterionStatusLabel(status: CriterionStatus, language: Language): string {
  return criteriaMessage(`criteria.status.${status}`, language);
}

/** Titre de la section de critères écrite dans la description (SPEC §8.2). */
export function criteriaSectionTitle(language: Language): string {
  return criteriaMessage('criteria.section.title', language);
}

/** Note de bas de section : ce que l'app tient et qui valide (SPEC §8.2, §8.3). */
export function criteriaSectionSummary(count: number, language: Language): string {
  return criteriaMessage('criteria.section.summary', language, { count });
}
