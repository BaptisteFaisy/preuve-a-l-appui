/**
 * Messages des actions Rovo / MCP (SPEC §15, §20) — lot L5.
 *
 * Dictionnaire pur, anglais et français, interpolé par `src/i18n/index.ts`.
 * Aucune chaîne visible par l'utilisateur ne vit dans le code.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Messages } from './index';

export const ACTION_MESSAGES: Messages = {
  /* ---------------------------------------------------------------- erreurs */
  'err.forbidden.action': {
    en: 'Action not allowed: agents cannot attest, waive, validate criteria or alter requirements directly (SPEC §15, §22 point 11).',
    fr: "Action interdite : un agent ne peut ni attester, ni déroger, ni valider un critère, ni modifier la grille d'exigences (SPEC §15, §22 point 11).",
  },
  'err.unknown.action': {
    en: 'Unknown action: {name}. Available tools: list-criteria, get-proof-status, attach-evidence, propose-criteria, request-attestation, suggest-evidence, get-release-proof.',
    fr: 'Action inconnue : {name}. Outils disponibles : list-criteria, get-proof-status, attach-evidence, propose-criteria, request-attestation, suggest-evidence, get-release-proof.',
  },
  'err.missing.input': {
    en: 'Missing required input: {name}.',
    fr: 'Entrée obligatoire manquante : {name}.',
  },
  'err.issue.notFound': {
    en: 'Issue not found: {issueKey}.',
    fr: 'Ticket introuvable : {issueKey}.',
  },
  'err.criterion.notFound': {
    en: 'Criterion {criterionId} not found on issue {issueKey}.',
    fr: 'Critère {criterionId} introuvable sur le ticket {issueKey}.',
  },
  'err.evidence.invalidType': {
    en: 'Invalid evidence type "{type}". Accepted types: test, documentation, attestation, attachment, agent-report, link (SPEC §9.1).',
    fr: 'Type de preuve invalide "{type}". Types acceptés : test, documentation, attestation, attachment, agent-report, link (SPEC §9.1).',
  },
  'err.propose.empty': {
    en: 'No criteria provided to propose.',
    fr: 'Aucun critère fourni à proposer.',
  },
  'err.suggest.emptyTests': {
    en: 'No test names provided to suggest evidence.',
    fr: 'Aucun nom de test fourni pour suggérer des preuves.',
  },
  'err.version.notFound': {
    en: 'Version not found: {versionId}.',
    fr: 'Version introuvable : {versionId}.',
  },

  /* ---------------------------------------------------------- list-criteria */
  'list.none': {
    en: 'No criteria defined for issue {issueKey}.',
    fr: 'Aucun critère défini pour le ticket {issueKey}.',
  },
  'list.summary': {
    en: 'Issue {issueKey} criteria ({total}) :',
    fr: 'Critères du ticket {issueKey} ({total}) :',
  },

  /* ------------------------------------------------------- get-proof-status */
  'status.passed': {
    en: 'Issue {issueKey} proof coverage is complete: {proven}/{total} proven ({waived} waived). All criteria satisfied.',
    fr: 'Couverture du ticket {issueKey} complète : {proven}/{total} prouvés ({waived} dérogés). Tous les critères sont satisfaits.',
  },
  'status.blocked': {
    en: 'Issue {issueKey} proof coverage is incomplete: {proven}/{total} proven ({waived} waived). {blockingCount} criteria in default.',
    fr: 'Couverture du ticket {issueKey} incomplète : {proven}/{total} prouvés ({waived} dérogés). {blockingCount} critères en défaut.',
  },
  'status.expected': {
    en: 'expected',
    fr: 'attendu',
  },

  /* --------------------------------------------------------- défauts (§7.2) */
  'defect.no-evidence': {
    en: 'no evidence attached',
    fr: 'aucune preuve attachée',
  },
  'defect.weak-strength': {
    en: 'insufficient evidence strength',
    fr: 'force de preuve insuffisante',
  },
  'defect.not-fresh': {
    en: 'evidence is no longer fresh',
    fr: 'la preuve n’est plus fraîche',
  },
  'defect.not-independent': {
    en: 'attestation must come from an independent role',
    fr: 'l’attestation doit venir d’un rôle indépendant',
  },
  'defect.unverified': {
    en: 'evidence could not be verified by the app',
    fr: 'preuve non vérifiée par l’application',
  },
  'defect.no-criteria': {
    en: 'no acceptance criteria defined on this ticket',
    fr: 'aucun critère d’acceptation défini sur ce ticket',
  },

  /* -------------------------------------------------------- attach-evidence */
  'attach.agent.success': {
    en: 'Evidence {evidenceId} attached to {criterionId}. Strength is declared ({strength}). A human attestation or a machine-verified check is required for higher requirements.',
    fr: 'Preuve {evidenceId} attachée à {criterionId}. Force : déclarée ({strength}). Une attestation humaine ou une vérification machine est requise pour une exigence supérieure.',
  },
  'attach.success': {
    en: 'Evidence {evidenceId} attached to {criterionId} with strength {strength}.',
    fr: 'Preuve {evidenceId} attachée à {criterionId} avec la force {strength}.',
  },

  /* ------------------------------------------------------- propose-criteria */
  'propose.success': {
    en: 'Proposed {count} criteria for {issueKey}. They are pending human validation and do not count toward proof coverage until validated (SPEC §8.3).',
    fr: '{count} critères proposés pour {issueKey}. Ils sont en attente de validation humaine et ne comptent pas dans la couverture tant qu’ils ne sont pas validés (SPEC §8.3).',
  },

  /* ---------------------------------------------------- request-attestation */
  'request.success': {
    en: 'Attestation requested for {criterionId} on {issueKey} addressed to role "{role}" ({count} recipient(s) notified). The assignee cannot attest.',
    fr: 'Attestation demandée pour {criterionId} sur {issueKey} au rôle "{role}" ({count} destinataire(s) notifié(s)). L’assigné ne peut pas attester.',
  },
  'request.noRecipient': {
    en: 'Attestation requested for {criterionId} on {issueKey} for role "{role}", but no eligible recipient was found (assignee excluded).',
    fr: 'Attestation demandée pour {criterionId} sur {issueKey} pour le rôle "{role}", mais aucun destinataire éligible n’a été trouvé (assigné exclu).',
  },

  /* ------------------------------------------------------- suggest-evidence */
  'suggest.none': {
    en: 'No test-to-criterion suggestions found for {issueKey}.',
    fr: 'Aucune suggestion test-critère trouvée pour {issueKey}.',
  },
  'suggest.success': {
    en: 'Suggested {count} test pair(s) for {issueKey}. Note: suggestions do not count as proof until confirmed by a human (SPEC §11).',
    fr: '{count} paire(s) test-critère suggérée(s) pour {issueKey}. Note : une suggestion ne compte comme preuve qu’après confirmation humaine (SPEC §11).',
  },

  /* ------------------------------------------------------ get-release-proof */
  'release.summary': {
    en: 'Release {versionName}: {issuesCount} issues, {criteriaCount} criteria, {provenCount} proven, {waivedCount} waived, {unprovenDeliveredCount} unproven delivered.',
    fr: 'Version {versionName} : {issuesCount} tickets, {criteriaCount} critères, {provenCount} prouvés, {waivedCount} dérogés, {unprovenDeliveredCount} critères livrés non prouvés.',
  },
  'release.unprovenHeader': {
    en: 'Delivered but no longer proven:',
    fr: 'Critères livrés qui ne sont plus prouvés :',
  },
};
