/**
 * Sélection de la langue du site : anglais par défaut (langue de soumission),
 * français sur demande, choix mémorisé dans le navigateur (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { EN } from './en.js';
import { FR } from './fr.js';
import type { SiteStrings } from './types.js';

export type Lang = 'en' | 'fr';

export const LANGS: readonly Lang[] = ['en', 'fr'];

const STORAGE_KEY = 'proof-site-lang';

export const STRINGS: Readonly<Record<Lang, SiteStrings>> = { en: EN, fr: FR };

export function stringsFor(lang: Lang): SiteStrings {
  return STRINGS[lang];
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'fr' : 'en';
}

/** Langue enregistrée, sinon celle du navigateur, sinon l'anglais. */
export function initialLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
    const nav = window.navigator.language.toLowerCase();
    return nav.startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function rememberLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* navigation privée : le choix reste valable pour la session */
  }
}

export type { SiteStrings };
