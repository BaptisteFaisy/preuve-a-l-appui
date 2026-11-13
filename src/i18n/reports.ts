/**
 * Messages du lot L7 : rapprochement tests ↔ critères, demande d'attestation,
 * statistiques et dossier de preuve (SPEC §11, §14 FP-14/15/17/18, §20).
 *
 * Toute chaîne visible par l'utilisateur passe par ce fichier, en anglais et en
 * français (docs/CONVENTIONS.md). Les clés suivent `domaine.point` et le
 * préfixe `reports.` ; celles du handler d'attestation gardent le préfixe
 * `attestation.` de l'outil `request-attestation` (SPEC §15).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Language, Strength } from '../types';
import type { MessageVars, Messages } from './index';
import { translate } from './index';

/** Dictionnaire du lot L7 : aucun autre lot n'y écrit. */
export const REPORT_MESSAGES: Messages = {
  /* Les trois forces, telles qu'affichées dans les rapports (SPEC §9.1). */
  'reports.strength.declared': { en: 'Declared', fr: 'Déclarée' },
  'reports.strength.attested': { en: 'Attested', fr: 'Attestée' },
  'reports.strength.machine-verified': { en: 'Machine-verified', fr: 'Vérifiée par machine' },

  /* Rapprochement tests ↔ critères (SPEC §11, §21). */
  'reports.matching.rationale': {
    en: 'Deterministic fallback: shared keywords ({words}).',
    fr: 'Repli déterministe : mots-clés communs ({words}).',
  },
  'reports.matching.rationale.empty': {
    en: 'Deterministic fallback: the test name matches the criterion text.',
    fr: 'Repli déterministe : le nom du test reprend le texte du critère.',
  },
  'reports.matching.shared': {
    en: 'Test "{name}" proves {count} criteria: allowed, but check it is not too broad.',
    fr: 'Le test « {name} » prouve {count} critères : autorisé, mais vérifiez qu’il n’est pas trop large.',
  },
  'reports.matching.renamed': {
    en: 'Test renamed from "{old}" to "{new}": the confirmed pair is lost, a new one is proposed.',
    fr: 'Test renommé de « {old} » à « {new} » : la paire confirmée est perdue, une nouvelle est proposée.',
  },
  'reports.matching.modelDown': {
    en: 'The model is unavailable: falling back to name matching.',
    fr: 'Le modèle est indisponible : repli sur la correspondance de noms.',
  },

  /* Demande d'attestation (SPEC §9.4, FP-15, §15). */
  'attestation.request.subject': {
    en: 'Attestation requested on {issueKey}',
    fr: 'Attestation demandée sur {issueKey}',
  },
  'attestation.request.body': {
    en: 'Please attest criterion {code} on {issueKey}: {text}. Asking proves nothing by itself.',
    fr: 'Merci d’attester le critère {code} sur {issueKey} : {text}. Demander ne prouve rien en soi.',
  },
  'attestation.request.error.issueNotFound': {
    en: 'Issue {issueKey} not found: no attestation can be requested.',
    fr: 'Ticket {issueKey} introuvable : aucune attestation ne peut être demandée.',
  },
  'attestation.request.error.assignee': {
    en: 'The assignee cannot attest their own work: choose another person.',
    fr: 'L’assigné ne peut pas attester son propre travail : choisissez une autre personne.',
  },
  'attestation.request.error.criterionNotFound': {
    en: 'Criterion {code} not found on {issueKey}: check the criterion code.',
    fr: 'Critère {code} introuvable sur {issueKey} : vérifiez le code du critère.',
  },
  'attestation.request.error.role': {
    en: 'Criterion {code} requires the competent role: the target does not hold it.',
    fr: 'Le critère {code} exige le rôle compétent : la personne visée ne l’a pas.',
  },

  /* Statistiques (SPEC §14 FP-18). */
  'reports.stats.coverage': {
    en: 'Proof coverage by strength',
    fr: 'Couverture des preuves par force',
  },
  'reports.stats.waivers': { en: 'Waivers by person', fr: 'Dérogations par personne' },
  'reports.stats.reopenings': {
    en: 'Reopenings by proof strength',
    fr: 'Réouvertures selon la force des preuves',
  },
  'reports.stats.closedWithoutValidator': {
    en: 'Issues closed outside the validator: {count}',
    fr: 'Tickets clos hors validateur : {count}',
  },
  'reports.stats.line': { en: '- {label}: {count}', fr: '- {label} : {count}' },
  'reports.stats.reopening.line': {
    en: '- {label}: {reopened} reopened out of {closed} ({share} %)',
    fr: '- {label} : {reopened} réouverts sur {closed} ({share} %)',
  },

  /* Dossier de preuve (SPEC §17, FP-17). */
  'reports.dossier.title': {
    en: 'Proof dossier — version {versionName} ({projectKey})',
    fr: 'Dossier de preuve — version {versionName} ({projectKey})',
  },
  'reports.dossier.generatedAt': { en: 'Generated on {date}', fr: 'Généré le {date}' },
  'reports.dossier.summary': { en: 'Release summary', fr: 'Résumé de la version' },
  'reports.dossier.issues': { en: 'Issues: {count}', fr: 'Tickets : {count}' },
  'reports.dossier.criteria': { en: 'Criteria: {count}', fr: 'Critères : {count}' },
  'reports.dossier.proven': { en: 'Proven: {count}', fr: 'Prouvés : {count}' },
  'reports.dossier.waived': { en: 'Waived: {count}', fr: 'Dérogés : {count}' },
  'reports.dossier.detail': { en: 'Issue by issue', fr: 'Détail par ticket' },
  'reports.dossier.issueHeading': {
    en: '### {issueKey} — {summary}',
    fr: '### {issueKey} — {summary}',
  },
  'reports.dossier.issueCoverage': {
    en: 'Coverage: {proven} / {total} proven criteria, {waived} waiver(s).',
    fr: 'Couverture : {proven} / {total} critères prouvés, {waived} dérogation(s).',
  },
  'reports.dossier.column.criterion': { en: 'Criterion', fr: 'Critère' },
  'reports.dossier.column.strength': { en: 'Required', fr: 'Force exigée' },
  'reports.dossier.column.state': { en: 'State', fr: 'État' },
  'reports.dossier.column.evidence': { en: 'Evidence', fr: 'Preuve' },
  'reports.dossier.column.attester': { en: 'Attester', fr: 'Attestant' },
  'reports.dossier.column.date': { en: 'Date', fr: 'Date' },
  'reports.dossier.column.commit': { en: 'Commit', fr: 'Commit' },
  'reports.dossier.column.waiver': { en: 'Waiver', fr: 'Dérogation' },
  'reports.dossier.state.proven': { en: 'Proven', fr: 'Prouvé' },
  'reports.dossier.state.waived': { en: 'Waived', fr: 'Dérogé' },
  'reports.dossier.state.unproven': { en: 'Unproven', fr: 'Non prouvé' },
  'reports.dossier.none': { en: '—', fr: '—' },
  'reports.dossier.agent': { en: 'Agent', fr: 'Agent' },
  'reports.dossier.waiverLine': {
    en: '{reason} (granted by {granter})',
    fr: '{reason} (accordée par {granter})',
  },
};

/** Traduit une clé du lot L7 avec ses variables d'interpolation. */
export function reportMessage(key: string, language: Language, vars: MessageVars = {}): string {
  return translate(REPORT_MESSAGES, key, language, vars).text;
}

/** Libellé d'une force de preuve (SPEC §9.1), dans la langue du projet. */
export function strengthLabel(strength: Strength, language: Language): string {
  return reportMessage(`reports.strength.${strength}`, language);
}
