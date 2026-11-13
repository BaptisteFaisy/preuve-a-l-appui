/**
 * PRF-5 — « Publier la page d'aide sur le refus ».
 *
 * L'histoire : le client doit pouvoir comprendre le refus sans appeler le
 * support. L'agent propose la page, pose un lien vers la publication et un
 * critère **en attente de validation** : un humain n'a pas encore validé le
 * critère de traduction, donc il ne compte pas dans la couverture
 * (SPEC §8.3).
 *
 * Le ticket n'est **pas** livré : la preuve documentaire n'a pas encore été
 * vérifiée par la machine, la page reste en cours de publication.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-5',
  summary: "Publier la page d'aide sur le refus",
  description: [
    "Le client refuse ne doit pas avoir besoin d'appeler le support : une page publique explique les motifs de refus et la marche à suivre.",
    "Ce ticket couvre la rédaction, la publication et la traduction de cette page.",
    "Un critère est encore proposé : l'agent l'a écrit, un humain ne l'a pas validé. Il ne compte pas dans la couverture.",
  ].join('\n'),
  component: 'checkout-help',
  branch: 'feature/PRF-5-help-page',
  tests: [],
  mainTests: [],
  cast: DEMO_CAST,
  close: false,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'La page d’aide liste les motifs de refus et la marche à suivre',
        type: 'documentation',
        requiredStrength: 'machine-verified',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: 'La page d’aide est aussi publiée en anglais',
        type: 'documentation',
        requiredStrength: 'machine-verified',
        status: 'proposed',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'documentation',
        reference: 'docs/aide-refus.md',
        note: 'Brouillon de la page d’aide.',
        addedBy: 'developer',
      },
      {
        criterion: 'AC-1',
        type: 'link',
        reference: 'https://one-atlas-cndz.atlassian.net/wiki/spaces/PRF/pages/aide-refus',
        note: 'Page d’aide publiée, en cours de relecture.',
        addedBy: 'developer',
      },
    ],
    attest: [],
    waive: [],
    links: [],
    revisions: [
      {
        code: 'AC-1',
        text: 'La page d’aide liste les motifs de refus, la marche à suivre et le délai de traitement',
      },
    ],
  },
};
