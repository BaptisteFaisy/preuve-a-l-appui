/**
 * Textes du bandeau de provenance de la démo (lot `site-donnees-reelles`).
 *
 * Le bandeau dit d'où viennent les données affichées : lues en direct dans
 * l'app installée sur le site de démonstration, ou le jeu embarqué quand le
 * réseau manque. Rien n'est laissé deviner au visiteur.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Les textes du bandeau, identiques en FR et en EN. */
export interface LiveStrings {
  readonly liveTitle: string;
  readonly liveBody: string;
  readonly embeddedTitle: string;
  readonly embeddedBody: string;
  readonly readAt: string;
}

export const LIVE_STRINGS: Readonly<Record<Lang, LiveStrings>> = {
  en: {
    liveTitle: 'Live data',
    liveBody:
      'Read in the app installed on {site} — ticket {issue}, {readAt}. Criteria, proofs and coverage come from Jira and from the app’s own database.',
    embeddedTitle: 'Embedded dataset',
    embeddedBody:
      'The app could not be reached ({reason}): this demo runs on the PAY-123 dataset from the repository.',
    readAt: 'read at',
  },
  fr: {
    liveTitle: 'Données réelles',
    liveBody:
      'Lues dans l’app installée sur {site} — ticket {issue}, {readAt}. Critères, preuves et couverture viennent de Jira et de la base de l’app.',
    embeddedTitle: 'Jeu embarqué',
    embeddedBody:
      'L’app n’a pas pu être jointe ({reason}) : cette démo tourne sur le jeu PAY-123 du dépôt.',
    readAt: 'lues à',
  },
};

/** Remplace les `{clés}` d'un gabarit ; une clé absente laisse son marqueur. */
export function fillText(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}
