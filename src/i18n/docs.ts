/**
 * Labels and messages for the demo dataset and the documentation
 * (SPEC §20, §22, §24). Every visible string of lot L8 lives here, in
 * English and in French.
 *
 * Rule: files < 500 lines, functions < 50 lines.
 */
import type { Messages } from './index';

export const DOCS_MESSAGES: Messages = {
  'sample.title': {
    en: 'Done, With Proof - Demo Dataset PAY-123',
    fr: "Fait, preuve à l'appui - Jeu de démo PAY-123",
  },
  'sample.description': {
    en: 'Ready-to-replay scenario: 4 criteria, 2 machine-verified proofs, 1 awaiting a third-party attestation, 1 without evidence — coverage 2 / 4',
    fr: "Scénario prêt à rejouer : 4 critères, 2 preuves vérifiées par machine, 1 en attente d'attestation, 1 sans preuve — couverture 2 / 4",
  },
  'sample.criterion.ac1.text': {
    en: 'Expired card payment is refused',
    fr: 'Le paiement par carte expirée est refusé',
  },
  'sample.criterion.ac2.text': {
    en: 'A payment already refused cannot be processed again',
    fr: 'Un paiement déjà refusé ne repasse pas',
  },
  'sample.criterion.ac3.text': {
    en: 'Refusal email is sent to the customer',
    fr: "L'e-mail de refus est envoyé",
  },
  'sample.criterion.ac4.text': {
    en: 'Refusal threshold is configurable by the administrator',
    fr: "La limite est réglable par l'administrateur",
  },
  'sample.test.refusal': {
    en: 'checkout refuses an expired card',
    fr: 'le paiement refuse une carte expirée',
  },
  'sample.test.log': {
    en: 'checkout logs the refusal reason',
    fr: 'le paiement journalise le motif du refus',
  },
  'sample.evidence.test.note': {
    en: 'Passed on the pull-request branch commit',
    fr: 'Passé sur le commit de la branche de PR',
  },
  'sample.evidence.report.note': {
    en: 'The agent report mentions AC-3.',
    fr: "Le compte rendu de l'agent cite AC-3.",
  },
  'sample.waiver.reason': {
    en: 'Postponed to PAY-140',
    fr: 'Reporté dans PAY-140',
  },
  'sample.attestation.note': {
    en: 'Refusal triggered manually, confirmation email received',
    fr: 'Refus déclenché manuellement, e-mail de confirmation reçu',
  },
  'sample.expect.machine': {
    en: 'A test green on the branch commit',
    fr: 'Test vert sur le commit de la branche',
  },
  'sample.expect.attested': {
    en: 'A third-party attestation is expected; a declaration was received',
    fr: "Attestation d'un tiers attendue, déclaration reçue",
  },
  'sample.expect.none': {
    en: 'No evidence attached',
    fr: 'Aucune preuve attachée',
  },
  'sample.coverage.summary': {
    en: '{proven} of {total} criteria proven ({percent}%)',
    fr: '{proven} sur {total} critères prouvés ({percent}%)',
  },
};
