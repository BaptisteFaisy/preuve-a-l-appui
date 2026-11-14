/**
 * Textes du bandeau de provenance de la démo (lots `site-donnees-reelles`,
 * `site-demo-live`).
 *
 * Le bandeau dit d'où viennent les données affichées, depuis quand, et ce qui
 * reste en mémoire : rien n'est laissé deviner au visiteur. Les textes vivent
 * ici, la mise en forme pure dans `demo/freshness.ts`, l'affichage dans
 * `demo/parts/DataFreshness.tsx`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Les textes du bandeau, en français et en anglais. */
export interface LiveStrings {
  readonly liveTitle: string;
  readonly liveBody: string;
  readonly embeddedTitle: string;
  readonly embeddedBody: string;
  readonly readAt: string;
  /** Le titre du bloc d'âge des données. */
  readonly ageTitle: string;
  /** « Produites par l'app le 13 nov. 18:09 (il y a 21 h). » */
  readonly produced: string;
  /** « Relues par le navigateur à 14:58. » */
  readonly reloaded: string;
  /** Le bouton qui relance la lecture des données réelles. */
  readonly reload: string;
  /** L'état du bouton pendant la relecture. */
  readonly reloading: string;
  /** Le rappel de ce qui n'est jamais écrit dans le vrai Jira. */
  readonly gestures: string;
}

export const LIVE_STRINGS: Readonly<Record<Lang, LiveStrings>> = {
  en: {
    liveTitle: 'Real data',
    liveBody:
      'Read from the app installed on {site} — ticket {issue}. Criteria, proofs and coverage come from Jira and from the app’s own database.',
    embeddedTitle: 'Embedded dataset',
    embeddedBody:
      'The published snapshot could not be re-read ({reason}): this demo falls back to the dataset bundled at build time.',
    readAt: 'read at',
    ageTitle: 'How fresh this is',
    produced: 'written by the app on {stamp} ({age})',
    reloaded: 're-read by your browser on {stamp} ({age})',
    reload: 'Re-read the real data',
    reloading: 'Re-reading…',
    gestures:
      'Your gestures stay in this browser’s memory: nothing is ever written to the real Jira, and no account id leaves it.',
  },
  fr: {
    liveTitle: 'Données réelles',
    liveBody:
      'Lues dans l’app installée sur {site} — ticket {issue}. Critères, preuves et couverture viennent de Jira et de la base de l’app.',
    embeddedTitle: 'Jeu embarqué',
    embeddedBody:
      'L’instantané publié n’a pas pu être relu ({reason}) : la démo retombe sur le jeu embarqué à la construction.',
    readAt: 'lues à',
    ageTitle: 'Fraîcheur des données',
    produced: 'écrites par l’app le {stamp} ({age})',
    reloaded: 'relues par ton navigateur le {stamp} ({age})',
    reload: 'Relire les données réelles',
    reloading: 'Relecture…',
    gestures:
      'Vos gestes restent en mémoire dans ce navigateur : rien n’est écrit dans le vrai Jira, aucun identifiant de compte n’en sort.',
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
