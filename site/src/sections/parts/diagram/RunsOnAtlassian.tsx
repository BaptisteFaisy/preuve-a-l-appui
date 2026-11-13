/**
 * Le badge « Runs on Atlassian » (lot `site-vitrine-confiance`).
 *
 * Un libellé sobre, pas un logo : le programme se cite, il ne se contrefait
 * pas. La mention complète dit ce que le badge veut dire — l'app tourne chez
 * un vrai client, dans son tenant Jira — et renvoie à la vérification du
 * dépôt. La variante `compact` sert de pied de section.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../../../src/types.js';
import { VITRINE } from '../../../i18n/vitrine.js';
import { ELIGIBILITY_SOURCE_URL } from './sources.js';
import './vitrine.css';

/** La marque du badge : un sceau générique, jamais un logo Atlassian. */
function BadgeMark(): ReactElement {
  return (
    <svg
      className="atlas-badge-mark"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M 7.5 12.4 L 10.6 15.4 L 16.5 9" fill="none" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

/** Le badge complet, ou sa version d'une ligne pour les pieds de section. */
export function RunsOnAtlassian({
  lang,
  variant = 'full',
}: {
  lang: Language;
  variant?: 'full' | 'compact';
}): ReactElement {
  const t = VITRINE[lang].badge;
  if (variant === 'compact') {
    return (
      <p className="atlas-badge atlas-badge--compact">
        <BadgeMark />
        <span className="atlas-badge-label">{t.compact}</span>
      </p>
    );
  }
  return (
    <div className="atlas-badge atlas-badge--full">
      <BadgeMark />
      <p className="atlas-badge-body">
        <strong className="atlas-badge-label">{t.label}</strong>
        <span className="atlas-badge-meaning">{t.meaning}</span>
        <a className="atlas-badge-proof" href={ELIGIBILITY_SOURCE_URL} rel="noreferrer">
          {t.proof}
        </a>
      </p>
    </div>
  );
}
