/**
 * Pied de page du site public : sobre, une ligne, pas de navigation dupliquée.
 *
 * Les textes viennent de `site/src/i18n/` ; les liens pointent vers le dépôt
 * (licence et source). Lot `site/sections-c`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import { REPO_FILE_URL, REPO_URL } from './parts/liens-c.js';
import './Footer.css';

export function Footer({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  return (
    <footer className="footer" id="Footer">
      <div className="wrap footer-row">
        <p className="footer-built">{t.footer.built}</p>
        <p className="footer-meta">
          <a href={`${REPO_FILE_URL}LICENSE`} target="_blank" rel="noreferrer">
            {t.footer.license}
          </a>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <span>{t.footer.contest}</span>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {t.footer.source}
          </a>
        </p>
      </div>
    </footer>
  );
}
