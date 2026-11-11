/**
 * Section « Nav » du site public — souche posée par le socle du site.
 *
 * Propriétaire : lot `site/contenu`. Le contrat est gelé : le composant
 * exporté porte ce nom et accepte `{ lang }` (SPEC §20 : anglais et
 * français). Les textes viennent de `site/src/i18n/`, jamais en dur.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';

/** Props gelées : la coquille (`App.tsx`) fournit la langue et le bascule. */
export interface NavProps {
  lang: Language;
  onToggleLang: () => void;
}

export function Nav({ lang, onToggleLang }: NavProps): ReactElement {
  const t = stringsFor(lang);
  return (
    <header className="site-header">
      <div className="wrap site-header-row">
        <a className="site-brand" href="#content">
          <img src="./icon.svg" alt="" width="24" height="24" />
          <span>{t.hero.titleEmphasis}</span>
        </a>
        <button type="button" className="button secondary" onClick={onToggleLang}>
          {t.langLabel}
        </button>
      </div>
    </header>
  );
}
