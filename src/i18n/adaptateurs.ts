/**
 * Messages du lot L9 (adaptateurs) — anglais et français (SPEC §20).
 *
 * Les adaptateurs produisent très peu de texte visible : les notifications
 * reçoivent déjà leurs clés de message de l'appelant (SPEC §9.4) et les
 * messages du validateur appartiennent au lot L3. Restent deux chaînes que
 * l'adaptateur fabrique lui-même, d'où ce fichier (docs/CONVENTIONS.md,
 * « toute chaîne visible passe par src/i18n/<lot>.ts »).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Messages } from './index';

export const ADAPTATEURS_MESSAGES: Messages = {
  /** Nom affiché d'un agent dont le compte est connu (SPEC §19). */
  'identity.agent.named': {
    en: 'Agent ({accountId})',
    fr: 'Agent ({accountId})',
  },
  /** Nom affiché d'un agent dont le contexte ne porte aucun compte. */
  'identity.agent.anonymous': {
    en: 'Rovo agent',
    fr: 'Agent Rovo',
  },
  /** Nom affiché de repli d'un humain inconnu de Jira. */
  'identity.human.fallback': {
    en: 'Unknown user',
    fr: 'Utilisateur inconnu',
  },
  /** Justification d'une paire test ↔ critère proposée sans le modèle (§11). */
  'llm.pair.fallbackRationale': {
    en: 'Test name contains the criterion terms: {terms}',
    fr: 'Le nom du test contient les termes du critère : {terms}',
  },
};
