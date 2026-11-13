/**
 * Messages du lot L3 : blocage, validateur, dérogations, contrôle nocturne
 * (SPEC §7.2, §12, §20). Anglais et français pour chaque clé visible.
 *
 * Le domaine importe ce fichier (précédent des lots L1 et L2) : c'est un
 * dictionnaire pur, sans aucun import `@forge/*` — la règle du domaine est
 * tenue (docs/CONTRACTS.md §1).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Messages } from './index';

export const GATE_MESSAGES: Messages = {
  /* ------------------------------------------------ en-tête du message §7.2 */
  'gate.blocked.singular': {
    en: '1 criterion without sufficient proof.',
    fr: '1 critère sans preuve suffisante.',
  },
  'gate.blocked.plural': {
    en: '{count} criteria without sufficient proof.',
    fr: '{count} critères sans preuve suffisante.',
  },
  /** Une ligne nommée du message : `AC-3 « texte » : défaut.` */
  'gate.line': {
    en: '{code} "{text}": {defect}.',
    fr: '{code} « {text} » : {defect}.',
  },
  /** Renvoi au panneau pour les critères au-delà des deux nommés (SPEC §19). */
  'gate.more': {
    en: '... and {count} more: see the issue panel.',
    fr: '... et {count} de plus : voir le panneau du ticket.',
  },

  /* --------------------------------------- explication d'un défaut (Defect) */
  'gate.defect.noEvidence': {
    en: 'no proof',
    fr: 'aucune preuve',
  },
  'gate.defect.weakStrength': {
    en: '{expected} expected, {got} received',
    fr: '{expected} attendue, {got} reçue',
  },
  'gate.defect.notFresh': {
    en: 'proof needs reconfirmation',
    fr: 'preuve à reconfirmer',
  },
  'gate.defect.notIndependent': {
    en: 'attestation must come from an independent reviewer',
    fr: 'attestation non indépendante',
  },
  'gate.defect.unverified': {
    en: 'proof not verified by the app',
    fr: 'preuve non vérifiée par l’app',
  },
  'gate.defect.noCriteria': {
    en: 'no acceptance criteria defined',
    fr: 'aucun critère défini',
  },

  /* ------------------------------------------ les trois forces (SPEC §9.1) */
  'strength.declared': {
    en: 'declaration',
    fr: 'déclaration',
  },
  'strength.attested': {
    en: 'third-party attestation',
    fr: 'attestation d’un tiers',
  },
  'strength.machine-verified': {
    en: 'machine verification',
    fr: 'vérification par machine',
  },

  /* ------------------- preuve attendue, en toutes lettres (CriterionState) */
  'gate.expected.machine-verified': {
    en: 'Green automated test on the branch commit, or updated documentation page',
    fr: 'Test automatisé vert sur le commit de la branche, ou page de documentation mise à jour',
  },
  'gate.expected.attested': {
    en: 'Third-party attestation from an independent reviewer',
    fr: 'Attestation d’un tiers indépendant',
  },
  'gate.expected.declared': {
    en: 'Declared evidence (screenshot, agent report, link)',
    fr: 'Preuve déclarée (capture, compte rendu d’agent, lien)',
  },

  /* ------------------------------------ ticket sans critère (SPEC §8.3, §21) */
  'gate.missingCriteria.block': {
    en: 'No acceptance criteria defined: add them in the issue panel.',
    fr: 'Aucun critère d’acceptation défini : à ajouter dans le panneau du ticket.',
  },
  'gate.missingCriteria.suggest': {
    en: 'No acceptance criteria yet: suggested criteria are waiting for a human.',
    fr: 'Pas encore de critère : des critères proposés attendent une validation humaine.',
  },
  'gate.childrenNotCovered': {
    en: 'Subtasks must be proven before closing the parent issue',
    fr: 'Les sous-tâches doivent être couvertes avant de clore le ticket parent',
  },

  /* ------------------------------------------------- validateur (SPEC §12.1) */
  'gate.unknownIssue': {
    en: 'Issue not found: the transition is blocked until the app can read it.',
    fr: 'Ticket introuvable : la transition est bloquée tant que l’app ne peut pas le lire.',
  },
  'gate.coverageUnavailable': {
    en: 'Coverage unavailable: open the issue panel once, then try again.',
    fr: 'Couverture indisponible : ouvrez une fois le panneau du ticket, puis réessayez.',
  },

  /* ------------------------------------------ dérogations (SPEC §12.4) */
  'gate.waiver.reasonRequired': {
    en: 'A waiver needs a written reason.',
    fr: 'Une dérogation exige un motif écrit.',
  },
  'gate.waiver.criterionRequired': {
    en: 'A waiver applies to exactly one criterion.',
    fr: 'Une dérogation porte sur un seul critère.',
  },
  'gate.waiver.roleForbidden': {
    en: 'Your project role cannot grant waivers.',
    fr: 'Votre rôle projet ne permet pas d’accorder une dérogation.',
  },
  'gate.waiver.agentForbidden': {
    en: 'An agent can never grant a waiver.',
    fr: 'Un agent ne peut jamais accorder de dérogation.',
  },

  /* ------------------------------- champ « Preuves n / m » (SPEC §12.3) */
  'coverage.field.label': {
    en: 'Proofs {proven} / {total}',
    fr: 'Preuves {proven} / {total}',
  },

  /* --------------------------- contrôle nocturne des clôtures (SPEC §20) */
  'scheduled.summary': {
    en: '{count} issue(s) closed without sufficient proof in project {projectKey}.',
    fr: '{count} ticket(s) clos sans preuve suffisante sur le projet {projectKey}.',
  },
  'scheduled.leak.subject': {
    en: 'This issue was closed without sufficient proof',
    fr: 'Ce ticket a été clos sans preuve suffisante',
  },
  'scheduled.leak.body': {
    en: 'The proof gate did not run on this closure (bulk transition, automation or API). Reopen the issue or attach the missing proof.',
    fr: 'Le validateur n’a pas vu cette clôture (transition en masse, automatisation ou API). Rouvrez le ticket ou joignez la preuve manquante.',
  },
  'scheduled.waiver.expired.subject': {
    en: 'A waiver has expired',
    fr: 'Une dérogation a expiré',
  },
  'scheduled.waiver.expired.body': {
    en: 'The waiver on {code} expired on {date}. The criterion is no longer waived: the issue needs a proof, or a new waiver.',
    fr: 'La dérogation sur {code} a expiré le {date}. Le critère n’est plus dérogé : le ticket a besoin d’une preuve, ou d’une nouvelle dérogation.',
  },
  'scheduled.noProject': {
    en: 'Nightly check: no project id in the payload, nothing to audit.',
    fr: 'Contrôle nocturne : aucun identifiant de projet dans la charge utile, rien à auditer.',
  },
};
