/**
 * PRF-4 — « Journaliser chaque refus pour la traçabilité ».
 *
 * L'histoire : un refus laisse une trace. Le journal ne doit rien divulguer
 * (critère `security`), il conserve le motif et l'horodatage (critère `data`),
 * et il est écrit pour chaque refus. Les preuves sont de plusieurs types : un
 * test, une **capture** et une **page de procédure**, plus deux attestations
 * par deux personnes différentes.
 *
 * Note d'environnement : sur le site de démonstration, le type `security`
 * exige le rôle « Security Reviewer », que personne ne porte. Les critères de
 * sécurité sont donc prouvés ici par un test vérifié par machine, jamais par
 * une attestation : une attestation de sécurité serait refusée (SPEC §9.4).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-4',
  summary: 'Journaliser chaque refus pour la traçabilité',
  description: [
    "Chaque refus doit laisser une trace consultable : motif, horodatage, décision prise.",
    "Ce ticket couvre ce qui est écrit, ce qui ne doit surtout pas l'être, et la conservation de la trace.",
    "Les preuves sont multiples : un test automatique, une capture du journal, une procédure écrite, et deux attestations.",
  ].join('\n'),
  component: 'checkout-audit',
  branch: 'feature/PRF-4-audit-log',
  tests: [
    'every refusal writes an audit line',
    'audit line holds no card number',
  ],
  mainTests: ['every refusal writes an audit line', 'audit line holds no card number'],
  cast: DEMO_CAST,
  close: true,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'Le journal de refus ne contient ni numéro de carte ni secret',
        type: 'security',
        requiredStrength: 'attested',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: 'Le journal conserve le motif du refus et son horodatage',
        type: 'data',
        requiredStrength: 'attested',
        status: 'active',
      },
      {
        code: 'AC-3',
        text: 'Un refus écrit toujours une ligne de journal',
        type: 'functional',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'test',
        reference: 'audit line holds no card number',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
      {
        criterion: 'AC-2',
        type: 'attachment',
        reference: 'capture-journal-refus.png',
        note: 'Capture du journal de refus en production.',
        addedBy: 'developer',
      },
      {
        criterion: 'AC-2',
        type: 'documentation',
        reference: 'docs/journalisation-refus.md',
        note: 'Procédure de consultation du journal.',
        addedBy: 'developer',
      },
      {
        criterion: 'AC-3',
        type: 'test',
        reference: 'every refusal writes an audit line',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
    ],
    attest: [
      {
        code: 'AC-2',
        accountId: 'owner',
        note: 'Journal relu sur un échantillon de refus de la semaine.',
      },
    ],
    waive: [],
    links: [
      { code: 'AC-1', testName: 'audit line holds no card number', status: 'confirmed' },
      { code: 'AC-3', testName: 'every refusal writes an audit line', status: 'confirmed' },
    ],
    revisions: [],
  },
};
