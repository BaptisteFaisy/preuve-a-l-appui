/**
 * PRF-2 — « Envoyer l'e-mail de refus au client ».
 *
 * L'histoire : le client doit apprendre le refus. L'agent déclare ce qu'il a
 * constate (un compte rendu d'agent), une **autre personne** que l'assigné
 * atteste que l'e-mail est parti et qu'il est complet (SPEC §9.4).
 *
 * Le ticket est livré : ses trois critères sont prouvés (deux par la machine,
 * un par une attestation humaine).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-2',
  summary: "Envoyer l'e-mail de refus au client",
  description: [
    "Quand un paiement est refusé, le client doit le savoir vite et comprendre pourquoi.",
    "Ce ticket suit l'envoi de l'e-mail : sa destination, son contenu, et le fait qu'un refus n'envoie qu'un seul message.",
    "Les critères sont propres à ce ticket : ils ne parlent ni de carte expirée, ni de journal, ni de performance.",
  ].join('\n'),
  component: 'checkout-notifications',
  branch: 'feature/PRF-2-refusal-email',
  tests: ['refusal email reaches the customer', 'refusal email is sent only once'],
  mainTests: ['refusal email reaches the customer', 'refusal email is sent only once'],
  cast: DEMO_CAST,
  close: true,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: "L'e-mail de refus part vers l'adresse du client",
        type: 'functional',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: "L'e-mail contient le motif du refus et la marche à suivre",
        type: 'functional',
        requiredStrength: 'attested',
        status: 'active',
      },
      {
        code: 'AC-3',
        text: 'Un même refus n’envoie qu’un seul e-mail',
        type: 'regression',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'test',
        reference: 'refusal email reaches the customer',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
      {
        criterion: 'AC-2',
        type: 'agent-report',
        reference: 'report#ac-2',
        note: "Le compte rendu de l'agent décrit l'e-mail envoyé.",
        addedBy: 'agent',
      },
      {
        criterion: 'AC-3',
        type: 'test',
        reference: 'refusal email is sent only once',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
    ],
    attest: [
      {
        code: 'AC-2',
        accountId: 'tester',
        note: "E-mail reçu par le client et relu avec le service client.",
      },
    ],
    waive: [],
    links: [
      { code: 'AC-1', testName: 'refusal email reaches the customer', status: 'confirmed' },
      { code: 'AC-3', testName: 'refusal email is sent only once', status: 'confirmed' },
    ],
    revisions: [],
  },
};
