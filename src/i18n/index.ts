/**
 * Traduction : un helper pur, aucun dictionnaire central (docs/CONTRACTS.md).
 *
 * Chaque lot possède son propre fichier de messages (`src/i18n/<lot>.ts`), en
 * anglais et en français (SPEC §20). Rien n'est importé ici : deux lots ne se
 * rencontrent donc jamais dans ce fichier, qui reste gelé.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Language } from '../types.js';

/** Un dictionnaire : une clé, ses deux langues. */
export type Messages = Readonly<Record<string, Readonly<Record<Language, string>>>>;

/** Variables d'interpolation : `{code}` dans le message. */
export type MessageVars = Readonly<Record<string, string | number>>;

/** Résultat d'une traduction : le texte et la langue réellement utilisée. */
export interface Translated {
  text: string;
  language: Language;
}

/** Interpole `{nom}` par la valeur fournie. */
export function interpolate(template: string, vars: MessageVars): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

/** Traduit une clé, avec repli anglais puis clé nue si absente. */
export function translate(
  dictionary: Messages,
  key: string,
  language: Language,
  vars: MessageVars = {},
): Translated {
  const entry = dictionary[key];
  if (!entry) return { text: interpolate(key, vars), language };
  const template = entry[language] ?? entry.en ?? key;
  return { text: interpolate(template, vars), language };
}

/** Traduit en texte seul, pour les endroits qui n'ont pas besoin de la langue. */
export function text(
  dictionary: Messages,
  key: string,
  language: Language,
  vars: MessageVars = {},
): string {
  return translate(dictionary, key, language, vars).text;
}

/** Fusionne des dictionnaires de lots ; la dernière clé gagne est interdite. */
export function mergeDictionaries(...dictionaries: readonly Messages[]): Messages {
  const merged: Record<string, Readonly<Record<Language, string>>> = {};
  for (const dictionary of dictionaries) {
    for (const [key, entry] of Object.entries(dictionary)) {
      merged[key] = entry;
    }
  }
  return merged;
}
