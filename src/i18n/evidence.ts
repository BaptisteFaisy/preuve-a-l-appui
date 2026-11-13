/**
 * Dictionnaire de traduction du lot L2 — Preuves, forces, exigences.
 *
 * Tous les libellés des six types d'éléments de preuve, des trois forces,
 * des statuts de fraîcheur, des défauts et des raisons de refus d'attestation
 * sont définis ici en anglais et en français (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Messages } from './index';

export const EVIDENCE_MESSAGES: Messages = {
  // Types de preuves (SPEC §9.1)
  'evidence.type.test': {
    en: 'Automated test',
    fr: 'Test automatisé',
  },
  'evidence.type.documentation': {
    en: 'Documentation page',
    fr: 'Page de documentation',
  },
  'evidence.type.attestation': {
    en: 'Attestation',
    fr: 'Attestation',
  },
  'evidence.type.attachment': {
    en: 'Screenshot or media attachment',
    fr: 'Capture ou pièce jointe',
  },
  'evidence.type.agent-report': {
    en: 'Agent summary section',
    fr: "Compte rendu d’agent",
  },
  'evidence.type.link': {
    en: 'External link',
    fr: 'Lien libre',
  },

  // Forces (SPEC §4, §9.1)
  'evidence.strength.declared': {
    en: 'Declared',
    fr: 'Déclarée',
  },
  'evidence.strength.attested': {
    en: 'Attested',
    fr: 'Attestée',
  },
  'evidence.strength.machine-verified': {
    en: 'Machine-verified',
    fr: 'Vérifiée par machine',
  },

  // Fraîcheur (SPEC §9.3)
  'evidence.freshness.fresh': {
    en: 'Fresh',
    fr: 'Fraîche',
  },
  'evidence.freshness.to-reconfirm': {
    en: 'To reconfirm',
    fr: 'À reconfirmer',
  },
  'evidence.freshness.stale': {
    en: 'Stale',
    fr: 'Périmée',
  },

  // Raisons d'indépendance / refus d'attestation (SPEC §9.4, §21)
  'independence.allowed': {
    en: 'Allowed to attest',
    fr: 'Autorisé à attester',
  },
  'independence.refused.agent': {
    en: 'An agent cannot attest (declaration only)',
    fr: 'Un agent ne peut jamais attester (déclaration seulement)',
  },
  'independence.refused.assignee': {
    en: 'Assignee cannot attest their own criteria',
    fr: "L’assigné ne peut pas attester ses propres critères",
  },
  'independence.refused.former_assignee': {
    en: 'A former assignee cannot attest the work they did',
    fr: "Un ancien assigné ne peut pas attester le travail qu’il a fait",
  },
  'independence.refused.author': {
    en: 'Author of the change cannot attest (independent attester required)',
    fr: "L’auteur du travail ne peut pas attester (attestant indépendant exigé)",
  },
  'independence.refused.missing_role': {
    en: 'Missing designated project role: {role}',
    fr: 'Rôle projet désigné manquant : {role}',
  },
  'independence.refused.not_attester': {
    en: 'Actor is not allowed to attest in this project',
    fr: "L’acteur n’a pas le droit d’attester dans ce projet",
  },

  // Exigences et phrases de preuve attendue (SPEC §12.1, §7.2)
  'requirements.expected.machine-verified': {
    en: 'Green automated test on the branch commit, or updated documentation page',
    fr: 'Test automatisé vert sur le commit de la branche, ou page de documentation mise à jour',
  },
  'requirements.expected.attested': {
    en: 'Third-party attestation from an independent reviewer',
    fr: "Attestation d’un tiers indépendant",
  },
  'requirements.expected.declared': {
    en: 'Declared evidence (screenshot, agent report, link)',
    fr: "Preuve déclarée (capture, compte rendu d’agent, lien)",
  },
  'requirements.expected.security_attested': {
    en: 'Attestation by a designated Security Reviewer',
    fr: "Attestation par le rôle Sécurité désigné",
  },
  'requirements.expected.data_attested': {
    en: 'Attestation by someone other than the author',
    fr: "Attestation par quelqu’un d’autre que l’auteur",
  },
  'requirements.expected.performance_attested': {
    en: 'Attestation accompanied by a measurement link',
    fr: "Attestation accompagnée d’un lien de mesure",
  },
};
