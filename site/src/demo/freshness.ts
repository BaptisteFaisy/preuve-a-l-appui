/**
 * L'âge des données affichées (lot `site-demo-live`).
 *
 * Le bandeau de provenance disait « lues à 18:09 » sans dire de quel jour, ni
 * que l'horodatage venait d'un fichier publié hier. Ces trois fonctions sont
 * pures — pas de DOM, pas de réseau — donc testables en node, et c'est la seule
 * implémentation de l'âge : le bandeau et le badge partagent le même calcul.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from '../i18n/index.js';

/** Un palier d'âge : borne haute en secondes, diviseur, unité dans chaque langue. */
interface Step {
  readonly limit: number;
  readonly div: number;
  readonly fr: string;
  readonly en: string;
}

/** Les paliers, du plus court au plus long ; le dernier n'a pas de borne. */
const STEPS: readonly Step[] = [
  { limit: 59, div: 1, fr: 's', en: 's' },
  { limit: 3599, div: 60, fr: 'min', en: 'min' },
  { limit: 86399, div: 3600, fr: 'h', en: 'h' },
  { limit: Number.POSITIVE_INFINITY, div: 86400, fr: 'j', en: 'd' },
];

/** La date lisible d'un horodatage, dans la langue du site ; vide si absent. */
export function stampLabel(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (iso === '' || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** L'âge d'un horodatage en texte court : « il y a 21 h » ; vide si illisible. */
export function ageLabel(iso: string, nowMs: number, lang: Lang): string {
  const then = Date.parse(iso);
  if (iso === '' || Number.isNaN(then)) return '';
  const diff = Math.max(0, Math.round((nowMs - then) / 1000));
  const step = STEPS.find((candidate) => diff <= candidate.limit);
  if (step === undefined) return '';
  const value = Math.floor(diff / step.div);
  return lang === 'fr' ? `il y a ${value} ${step.fr}` : `${value} ${step.en} ago`;
}

/**
 * La fraîcheur, pour la couleur du badge : « fresh » jusqu'à quinze minutes,
 * « older » au-delà, « unknown » quand aucun horodatage n'est lisible.
 */
export function ageTone(iso: string, nowMs: number): 'fresh' | 'older' | 'unknown' {
  const then = Date.parse(iso);
  if (iso === '' || Number.isNaN(then)) return 'unknown';
  return nowMs - then <= 15 * 60 * 1000 ? 'fresh' : 'older';
}
