/**
 * Navigation du site : marque, ancres vers les sections, dépôt, langue.
 *
 * Les ancres pointent vers les `id` posés par `site/src/App.tsx` et par les
 * sections elles-mêmes. En dessous de 720 px, les ancres passent dans un
 * `<details>` natif : aucun JavaScript ajouté, le bouton de langue reste
 * visible (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import './Nav.css';

/** Props gelées : la coquille (`App.tsx`) fournit la langue et le bascule. */
export interface NavProps {
  lang: Language;
  onToggleLang: () => void;
}

const REPO = 'https://github.com/Tradoooo/preuve-a-l-appui';

/** Les ancres, dans l'ordre de lecture de la page. */
function anchors(t: ReturnType<typeof stringsFor>['nav']): { href: string; label: string }[] {
  return [
    { href: '#problem', label: t.problem },
    { href: '#rule', label: t.rule },
    { href: '#features', label: t.features },
    { href: '#demo', label: t.demo },
    { href: '#screens', label: t.screens },
    { href: '#agents', label: t.agents },
    { href: '#architecture', label: t.architecture },
    { href: '#recipe', label: t.recipe },
    { href: '#judges', label: t.judges },
  ];
}

export function Nav({ lang, onToggleLang }: NavProps): ReactElement {
  const t = stringsFor(lang);
  const links = anchors(t.nav);
  return (
    <header className="site-header">
      <div className="wrap site-header-row">
        <a className="site-brand" href="#content">
          <img src="./icon.svg" alt="" width="24" height="24" />
          <span>
            {t.hero.title}
            <strong>{t.hero.titleEmphasis}</strong>
          </span>
        </a>

        <nav className="site-nav" aria-label={t.nav.demo}>
          <details className="site-nav-details">
            <summary aria-label={t.skipToContent}>☰</summary>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </details>
          <ul className="site-nav-inline">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header-actions">
          <a className="button secondary" href={REPO} rel="noreferrer">
            GitHub
          </a>
          <button type="button" className="button" onClick={onToggleLang}>
            {t.langLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
