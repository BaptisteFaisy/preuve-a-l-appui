/**
 * Textes du bloc « dossier de preuve » du site public (lot `site-dossier`).
 *
 * Le dossier de la version est une donnée RÉELLE de l'app installée
 * (`snapshot.dossier`, le dossier figé de la version 2.4) : le site n'y
 * invente rien. Nul besoin donc de réécrire ce que l'app sait déjà dire —
 * le titre du dossier, les totaux et les états de critère viennent de
 * `src/i18n/reports.ts` et `src/i18n/ui.ts`. N'est écrit ici que ce que
 * l'app ne produit pas : les en-têtes du tableau des tickets et l'état
 * lisible d'un TICKET (livré / en cours / dérogé).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Le jeu de chaînes du bloc dossier, identique en FR et en EN. */
export interface DossierStrings {
  /** Titre du bloc, dans la section « Écrans ». */
  readonly blockTitle: string;
  /** En-tête « Résumé » de la colonne qui porte le résumé du ticket. */
  readonly colSummary: string;
  /** En-tête « Dérogations » de la colonne qui les compte. */
  readonly colWaivers: string;
  /** État d'un ticket dont tous les critères sont prouvés. */
  readonly stateDelivered: string;
  /** État d'un ticket encore en cours de preuve. */
  readonly stateInProgress: string;
  /** Mention « ce que ce bloc montre », en bas de bloc. */
  readonly shows: string;
}

export const DOSSIER_STRINGS: Readonly<Record<Lang, DossierStrings>> = {
  en: {
    blockTitle: 'The whole demo project, ticket by ticket',
    colSummary: 'Summary',
    colWaivers: 'Waivers',
    stateDelivered: 'Delivered',
    stateInProgress: 'In progress',
    shows:
      'What this block shows: every ticket of the release dossier, as the app froze it — coverage, active waivers and state. The dossier is read from the installed app, not written for the page.',
  },
  fr: {
    blockTitle: 'Tout le projet de démonstration, ticket par ticket',
    colSummary: 'Résumé',
    colWaivers: 'Dérogations',
    stateDelivered: 'Livré',
    stateInProgress: 'En cours',
    shows:
      'Ce que ce bloc montre : tous les tickets du dossier de preuve de la version, tels que l’app les a figés — couverture, dérogations actives et état. Le dossier est lu dans l’app installée, pas écrit pour la page.',
  },
};
