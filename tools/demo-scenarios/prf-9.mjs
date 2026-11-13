/**
 * PRF-9 — « Ne jamais journaliser le corps de la requête ».
 *
 * L'histoire : la trace d'un refus ne doit rien dire du paiement tenté. Ce
 * critère de type `data` exige **deux types de preuve distincts** (un test et
 * une procédure écrite) : c'est la **preuve croisée** (SPEC §9.2, lot C).
 *
 * À noter : la grille du projet ne demande qu'un type de preuve
 * (`minDistinctTypes: 1` par défaut) et le moteur de couverture ne fait
 * qu lire cette valeur aujourd'hui. Le critère est donc conçu pour être
 * prouve par les deux types : il passe dans les deux lectures.
 *
 * Le second critère n'a pas de preuve : il est livré sous **dérogation**
 * accordée par une autre personne que le product owner.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { DEMO_CAST } from './cast.mjs';

export default {
  key: 'PRF-9',
  summary: 'Ne jamais journaliser le corps de la requête',
  description: [
    "Quand un paiement est refusé, la trace technique doit dire pourquoi le paiement a été refusé, pas ce qu'il contenait.",
    "Ce ticket couvre le corps de la requête et les identifiants de paiement dans les traces d'erreur.",
    "Le premier critère est prouvé par deux types de preuve distincts ; le second est livré sous dérogation.",
  ].join('\n'),
  component: 'checkout-privacy',
  branch: 'feature/PRF-9-no-request-body-logs',
  tests: ['request body is never logged on refusal'],
  mainTests: ['request body is never logged on refusal'],
  cast: DEMO_CAST,
  close: true,
  reopen: false,
  scenario: {
    criteria: [
      {
        code: 'AC-1',
        text: 'Le corps de la requête refusée n’est jamais journalisé',
        type: 'data',
        requiredStrength: 'attested',
        status: 'active',
      },
      {
        code: 'AC-2',
        text: 'Les identifiants de paiement sont masqués dans les traces d’erreur',
        type: 'security',
        requiredStrength: 'attested',
        status: 'active',
      },
    ],
    evidences: [
      {
        criterion: 'AC-1',
        type: 'test',
        reference: 'request body is never logged on refusal',
        note: 'Test vert sur la branche du ticket.',
        addedBy: 'agent',
      },
      {
        criterion: 'AC-1',
        type: 'documentation',
        reference: 'docs/journalisation-donnees.md',
        note: 'Procédure de journalisation : ce qui est écrit, ce qui ne l’est pas.',
        addedBy: 'developer',
      },
    ],
    attest: [],
    waive: [
      {
        code: 'AC-2',
        accountId: 'tester',
        role: 'Administrators',
        reason:
          'Reporté à la version 2.5 : le masquage des identifiants arrive avec la reprise du logger. Le product owner est absent, l’administratrice assume la dérogation.',
      },
    ],
    links: [
      { code: 'AC-1', testName: 'request body is never logged on refusal', status: 'confirmed' },
    ],
    revisions: [],
  },
};
