/**
 * PRF-3 — « Rendre la limite de refus réglable par un administrateur ».
 *
 * L'histoire : l'administrateur règle la limite. Un critère est prouvé par un
 * test, l'autre n'a pas de preuve : le **product owner** accorde une
 * dérogation motivée (SPEC §12.4). Le ticket part quand même, et la
 * dérogation reste au dossier de la version.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-3',
  summary: 'Rendre la limite de refus réglable par un administrateur',
  description: [
    "L'administrateur doit pouvoir fixer la limite au-delà de laquelle un paiement est refusé, sans intervention du support.",
    "Ce ticket couvre le réglage lui-même et la façon dont la limite s'applique à l'exécution.",
    "Un des deux critères n'a pas de preuve : il est livré sous dérogation motivée du product owner.",
  ].join('\n'),
  component: 'checkout-config',
  branch: 'feature/PRF-3-configurable-threshold',
  tests: ['administrator sets the refusal threshold'],
  mainTests: ['administrator sets the refusal threshold'],
  cast: DEMO_CAST,
  close: true,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'Un administrateur peut fixer la limite de refus',
        type: 'functional',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: 'La limite s’applique sans redémarrage du service',
        type: 'functional',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'test',
        reference: 'administrator sets the refusal threshold',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
    ],
    attest: [],
    waive: [
      {
        code: 'AC-2',
        accountId: 'owner',
        role: 'Product Owner',
        reason:
          "Reporté à la version 2.5 : le rechargement à chaud arrive avec la refonte du back-office. Le service redémarre après chaque réglage.",
      },
    ],
    links: [
      {
        code: 'AC-1',
        testName: 'administrator sets the refusal threshold',
        status: 'confirmed',
      },
    ],
    revisions: [],
  },
};
