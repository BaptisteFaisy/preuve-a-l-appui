/**
 * Textes propres aux deux maquettes supplémentaires du site : les réglages du
 * projet et la page projet (lot `site-toutes-features`).
 *
 * Priorité aux libellés que l'app produit déjà elle-même via
 * `text(UI_MESSAGES, …, lang)` (`src/i18n/ui.ts`) : on n'écrit en dur ici QUE
 * ce que les view-models ne produisent pas — les mentions du site (« ce que
 * l'écran montre »), les en-têtes de colonnes numériques des statistiques,
 * les états de preuve vivante (le view-model expose l'état brut) et la
 * mention « révoquée » d'une dérogation.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Le jeu de chaînes des deux maquettes, identique en FR et en EN. */
export interface ScreensExtraStrings {
  /** Mention « ce que l'écran montre » sous la maquette des réglages. */
  readonly settingsShows: string;
  /** Mention « ce que l'écran montre » sous la maquette de la page projet. */
  readonly projectShows: string;
  /** Étiquette de la langue du projet (aucune clé UI_MESSAGES). */
  readonly settingsLanguage: string;
  /** Marqueur de l'option de mode sélectionnée. */
  readonly settingsSelected: string;
  /** Exigence de preuve croisée ; `{n}` = types distincts exigés (SPEC §9.2). */
  readonly crossEvidence: string;
  /** En-tête « Nombre » des tableaux de statistiques. */
  readonly colCount: string;
  /** En-tête « Clos » du taux de réouverture. */
  readonly colClosed: string;
  /** En-tête « Réouverts » du taux de réouverture. */
  readonly colReopened: string;
  /** En-tête « Part » (pourcentage de réouvertures). */
  readonly colShare: string;
  /** En-tête « État » de la colonne d'état de preuve vivante. */
  readonly colState: string;
  /** État de preuve vivante `proven` (le view-model expose l'état brut). */
  readonly stateProven: string;
  /** État de preuve vivante `regressed`. */
  readonly stateRegressed: string;
  /** État de preuve vivante `unproven`. */
  readonly stateUnproven: string;
  /** Mention d'une dérogation révoquée (`isRevoked` du view-model). */
  readonly revoked: string;
}

export const SCREENS_EXTRA: Readonly<Record<Lang, ScreensExtraStrings>> = {
  en: {
    settingsShows:
      'What this screen shows: the strength grid per criterion type (FP-05), the roles that attest and waive, the gate mode, and the one-line CI command to copy.',
    projectShows:
      'What this screen shows: in-flight tickets and their coverage, waivers with their active counter, delivered criteria that are no longer proven (FP-19), and the project statistics (FP-18).',
    settingsLanguage: 'Project language',
    settingsSelected: 'Selected',
    crossEvidence: 'Cross-evidence: {n} distinct types',
    colCount: 'Count',
    colClosed: 'Closed',
    colReopened: 'Reopened',
    colShare: 'Share',
    colState: 'State',
    stateProven: 'Proven',
    stateRegressed: 'Regressed',
    stateUnproven: 'No longer proven',
    revoked: 'Revoked',
  },
  fr: {
    settingsShows:
      'Ce que l’écran montre : la grille des forces exigées par type de critère (FP-05), les rôles qui attestent et dérogent, le mode du validateur et la commande de CI d’une ligne à copier.',
    projectShows:
      'Ce que l’écran montre : les tickets en cours et leur couverture, les dérogations et leur compteur actif, les critères livrés qui ne sont plus prouvés (FP-19) et les statistiques du projet (FP-18).',
    settingsLanguage: 'Langue du projet',
    settingsSelected: 'Sélectionné',
    crossEvidence: 'Preuve croisée : {n} types distincts',
    colCount: 'Nombre',
    colClosed: 'Clos',
    colReopened: 'Réouverts',
    colShare: 'Part',
    colState: 'État',
    stateProven: 'Prouvé',
    stateRegressed: 'Régression',
    stateUnproven: 'Plus prouvé',
    revoked: 'Révoquée',
  },
};
