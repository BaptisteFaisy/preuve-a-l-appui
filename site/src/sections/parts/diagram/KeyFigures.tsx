/**
 * La bande de chiffres clés, en tête de page (lot `site-vitrine-confiance`).
 *
 * Les chiffres viennent de `key-figures.ts`, qui les LIT dans l'instantané
 * réel embarqué (`bundledSnapshot()`) : aucun nombre n'est recopié dans le
 * JSX. Les chiffres du dépôt sont écrits en dur dans `sources.ts`, avec leur
 * date de mesure et un lien vers le fichier qui les prouve.
 *
 * Chaque chiffre porte sa source : le visiteur peut vérifier.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { DemoSnapshotData } from '../../../../../src/demo-contract.js';
import type { Language } from '../../../../../src/types.js';
import { bundledSnapshot } from '../../../demo/live-snapshot.js';
import { VITRINE } from '../../../i18n/vitrine.js';
import { keyFigures } from './key-figures.js';
import type { FigureItem } from './key-figures.js';
import './vitrine.css';

/** Un chiffre : sa valeur, son libellé, son détail, sa source (un lien). */
function Figure({ item }: { item: FigureItem }): ReactElement {
  return (
    <li className="figures-item">
      <span className="figures-value">{item.value}</span>
      <span className="figures-label">{item.label}</span>
      {item.detail.length > 0 ? <span className="figures-detail">{item.detail}</span> : null}
      <a className="figures-source" href={item.href} rel="noreferrer">
        {item.source}
      </a>
    </li>
  );
}

/** La bande : un titre, la liste des chiffres, la date de mesure. */
export function KeyFigures({
  lang,
  snapshot = bundledSnapshot(),
}: {
  lang: Language;
  snapshot?: DemoSnapshotData | null;
}): ReactElement {
  const t = VITRINE[lang].figures;
  const band = keyFigures(lang, snapshot);
  const measured = band.measuredOn === null ? null : t.measuredOn.replace('{date}', band.measuredOn);
  const repoMeasured = t.repoMeasuredOn.replace('{date}', band.repoMeasuredOn);
  return (
    <div className="figures" aria-labelledby="figures-title">
      <div className="figures-head">
        <h2 id="figures-title" className="figures-title">
          {t.title}
        </h2>
        <p className="figures-lede">{t.lede}</p>
      </div>
      <ul className="figures-list">
        {band.items.map((item) => (
          <Figure key={item.id} item={item} />
        ))}
      </ul>
      <p className="figures-note">
        {measured === null ? repoMeasured : `${measured} · ${repoMeasured}`}
      </p>
      {band.notice === null ? null : <p className="figures-notice">{band.notice}</p>}
    </div>
  );
}
