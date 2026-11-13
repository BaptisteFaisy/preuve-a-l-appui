/**
 * PRF-8 — « Rendre le formulaire de refus accessible ».
 *
 * L'histoire : le client refuse peut être en situation de vulnérabilité : le
 * formulaire doit rester utilisable au clavier et annoncé par un lecteur
 * d'écran. Une **capture d'audit** accompagne l'attestation de la testeuse,
 * un **test** vérifie les libellés exposés par le formulaire.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-8',
  summary: 'Rendre le formulaire de refus accessible',
  description: [
    "Le client refuse peut être une personne en situation de vulnérabilité : le formulaire doit rester utilisable au clavier et annoncé correctement.",
    "Ce ticket couvre la navigation au clavier, les libellés du formulaire et le rendu sur les écrans de petite taille.",
    "Les preuves sont une capture d'audit et un test automatique, plus l'attestation de la testeuse.",
  ].join('\n'),
  component: 'checkout-web',
  branch: 'feature/PRF-8-accessible-refusal-form',
  tests: [
    'refusal form exposes accessible labels',
    'refusal form renders on small screens',
  ],
  mainTests: [
    'refusal form exposes accessible labels',
    'refusal form renders on small screens',
  ],
  cast: DEMO_CAST,
  close: true,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'Le formulaire de refus est utilisable au clavier et annoncé par un lecteur d’écran',
        type: 'accessibility',
        requiredStrength: 'attested',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: 'Le formulaire de refus expose un libellé pour chaque champ',
        type: 'functional',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'attachment',
        reference: 'capture-audit-accessibilite.png',
        note: 'Capture de l’audit d’accessibilité du formulaire.',
        addedBy: 'developer',
      },
      {
        criterion: 'AC-2',
        type: 'test',
        reference: 'refusal form exposes accessible labels',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
    ],
    attest: [
      {
        code: 'AC-1',
        accountId: 'tester',
        note: 'Audit refait au clavier et au lecteur d’écran.',
      },
    ],
    waive: [],
    links: [
      {
        code: 'AC-2',
        testName: 'refusal form exposes accessible labels',
        status: 'confirmed',
      },
    ],
    revisions: [],
  },
};
