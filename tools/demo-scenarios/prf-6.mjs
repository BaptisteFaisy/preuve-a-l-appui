/**
 * PRF-6 — « Ne jamais stocker le numéro de carte ».
 *
 * L'histoire : la donnée la plus sensible ne doit jamais être conservée. Le
 * critère est de type `security`, prouvé par un **test** automatique, et la
 * paire test ↔ critère est confirmée : c'est ce qui garde une **preuve
 * vivante** après la clôture (SPEC §13). Si le test disparaît de la branche
 * principale, l'app le signale sur le ticket.
 *
 * Sur le site de démonstration, le type `security` exige le rôle « Security
 * Reviewer » (absent de l'équipe) : le critère est donc prouvé par la
 * machine, pas par une attestation.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-6',
  summary: 'Ne jamais stocker le numéro de carte',
  description: [
    "Le numéro complet d'un moyen de paiement ne doit jamais quitter le tunnel : ni en base, ni dans les journaux, ni dans une trace d'erreur.",
    "Ce ticket couvre ce qui est conservé à la place : la marque, le titulaire masqué, les quatre derniers chiffres.",
    "La preuve est un test automatique, et sa paire avec le critère est confirmée : le ticket reste surveillé après la livraison.",
  ].join('\n'),
  component: 'checkout-payments',
  branch: 'feature/PRF-6-no-card-storage',
  tests: ['card number is never persisted', 'stored payment holds only the last four digits'],
  mainTests: ['card number is never persisted', 'stored payment holds only the last four digits'],
  cast: DEMO_CAST,
  close: true,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'Le numéro de carte n’est jamais écrit en base ni dans les journaux',
        type: 'security',
        requiredStrength: 'attested',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: 'Seuls les quatre derniers chiffres du moyen de paiement sont conservés',
        type: 'data',
        requiredStrength: 'attested',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'test',
        reference: 'card number is never persisted',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
      {
        criterion: 'AC-2',
        type: 'attachment',
        reference: 'capture-stockage-paiement.png',
        note: 'Capture de la ligne de base de paiement.',
        addedBy: 'developer',
      },
    ],
    attest: [
      {
        code: 'AC-2',
        accountId: 'tester',
        note: 'Extraction de la base relue avec l’équipe données.',
      },
    ],
    waive: [],
    links: [
      { code: 'AC-1', testName: 'card number is never persisted', status: 'confirmed' },
    ],
    revisions: [],
  },
};
