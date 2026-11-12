/**
 * Section « Fonctionnalités » du site public — lot `site-toutes-features`.
 *
 * La carte complète des 21 fonctionnalités du cahier des charges (§14),
 * groupées par priorité, chacune renvoyant vers l'endroit de la page où elle
 * est visible : la démo (#demo) exécute le vrai moteur, les maquettes
 * (#screens) rendent les vrais écrans, la section #agents liste les outils MCP.
 *
 * Les textes viennent de `site/src/i18n/features*.ts` : rien d'en dur.
 * `tests/site/features.test.ts` vérifie que la liste reste alignée sur le
 * cahier des charges (mêmes codes, mêmes priorités).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import {
  FEATURES_STRINGS,
  featuresOfPriority,
  type FeatureEntry,
  type FeaturePriority,
  type FeaturesStrings,
} from '../i18n/features.js';
import './Features.css';

/** Ordre d'affichage : indispensable, important, bonus. */
const PRIORITIES: readonly FeaturePriority[] = ['M', 'S', 'C'];

/** Une fonctionnalité : code, titre, description, priorité, ancre où la voir. */
function FeatureRow(props: { feature: FeatureEntry; badge: string }): ReactElement {
  const { feature, badge } = props;
  return (
    <tr className="features-row">
      <th scope="row" className="features-code">
        <code>{feature.code}</code>
      </th>
      <td className="features-cell">
        <span className="features-title">{feature.title}</span>
        <span className="features-desc">{feature.description}</span>
      </td>
      <td className="features-cell features-prio-cell">
        <span className={`features-prio features-prio--${feature.priority.toLowerCase()}`}>
          {feature.priority}
        </span>
      </td>
      <td className="features-cell features-where-cell">
        <a className="features-link" href={feature.where} aria-label={`${feature.code} — ${badge}`}>
          {badge} <span aria-hidden="true">→</span>
        </a>
      </td>
    </tr>
  );
}

/** Un groupe de priorité : son titre, sa table, ses lignes. */
function PriorityGroup(props: {
  priority: FeaturePriority;
  features: readonly FeatureEntry[];
  t: FeaturesStrings;
}): ReactElement {
  const { priority, features, t } = props;
  return (
    <section className="features-group" aria-labelledby={`features-group-${priority}`}>
      <h3 className="features-group-title" id={`features-group-${priority}`}>
        {t.groups[priority]}
        <span className="features-group-count">{features.length}</span>
      </h3>
      <div className="features-tablescroll">
      <table className="features-table">
        <caption className="visually-hidden">{`${t.groups[priority]} — ${t.priorityTitle}`}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">{t.colFeature}</span>
            </th>
            <th scope="col" className="features-col-desc">
              {t.colFeature}
            </th>
            <th scope="col">{t.priorityTitle}</th>
            <th scope="col">{t.colVisible}</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <FeatureRow key={feature.code} feature={feature} badge={t.badge} />
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}

export function Features({ lang }: { lang: Language }): ReactElement {
  const t = FEATURES_STRINGS[lang];
  return (
    <section id="features" className="features" aria-labelledby="features-title">
      <div className="wrap">
        <h2 id="features-title">{t.title}</h2>
        <p className="lede">{t.lede}</p>
        <p className="features-note">{t.priorityNote}</p>
        {PRIORITIES.map((priority) => (
          <PriorityGroup
            key={priority}
            priority={priority}
            features={featuresOfPriority(lang, priority)}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}
