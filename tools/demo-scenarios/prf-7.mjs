/**
 * PRF-7 — « Tenir le refus sous 200 ms ».
 *
 * L'histoire : le refus est sur le chemin critique du paiement. Le critère
 * est de type `performance`, prouvé par une **mesure** (le test de latence).
 *
 * C'est le témoin des **réouvertures** : le test a disparu de la branche
 * principale, la preuve vivante du critère livré tombe (SPEC §7.5, §13),
 * et le ticket est rouvert par l'opérateur. Le catalogue le marque
 * `reopen: true` : le rejoueur ne le rouvre qu'après l'avoir livré, et
 * jamais un ticket qui ne l'est pas.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-7',
  summary: 'Tenir le refus sous 200 ms',
  description: [
    "Un refus doit être décidé aussi vite qu'un paiement accepté : le client attend une réponse, pas un silence.",
    "Ce ticket fixe la cible de latence du chemin de refus et la mesure qui la vérifie.",
    "Le test de latence a disparu de la branche principale : la preuve du critère livré tombe, et le ticket est rouvert.",
  ].join('\n'),
  component: 'checkout-performance',
  branch: 'feature/PRF-7-refusal-latency',
  tests: ['refusal answers in under 200 ms at p95'],
  mainTests: [],
  cast: DEMO_CAST,
  close: true,
  reopen: true,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'Le refus est répondu en moins de 200 ms (p95)',
        type: 'performance',
        requiredStrength: 'attested',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'test',
        reference: 'refusal answers in under 200 ms at p95',
        note: 'Mesure de latence verte sur la branche du ticket.',
        addedBy: 'agent',
      },
    ],
    attest: [],
    waive: [],
    links: [
      { code: 'AC-1', testName: 'refusal answers in under 200 ms at p95', status: 'confirmed' },
    ],
    revisions: [],
  },
};
