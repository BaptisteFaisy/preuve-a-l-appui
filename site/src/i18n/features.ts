/**
 * Contrat et textes de la section « Fonctionnalités » du site (lot
 * `site-toutes-features`).
 *
 * La liste des fonctionnalités vient du cahier des charges, §14
 * (`docs/CAHIER-DES-CHARGES.md`, table FP-01…FP-21) : le site ne réinvente
 * rien, il rend cette table et dit où chaque ligne est visible sur la page.
 * `tests/site/features.test.ts` vérifie que rien ne dérive entre le document
 * et le site (mêmes codes, mêmes priorités).
 *
 * Les textes FR et EN vivent dans `features-fr.ts` et `features-en.ts` pour
 * rester sous la limite de 500 lignes par fichier.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';
import { FEATURES_EN } from './features-en.js';
import { FEATURES_FR } from './features-fr.js';

/** Priorité du cahier des charges §14 : M = indispensable, S = important, C = bonus. */
export type FeaturePriority = 'M' | 'S' | 'C';

/** Une fonctionnalité de l'app, telle que le site la présente. */
export interface FeatureEntry {
  /** Identifiant du cahier des charges, ex. `FP-07`. */
  readonly code: string;
  readonly priority: FeaturePriority;
  /** Titre court, lisible dans un tableau. */
  readonly title: string;
  /** Une phrase : ce que fait l'app, sans jargon commercial. */
  readonly description: string;
  /** Ancre RELATIVE de la section où la fonctionnalité est visible. */
  readonly where: string;
}

/** Les textes d'accompagnement de la section. */
export interface FeaturesStrings {
  readonly title: string;
  readonly lede: string;
  readonly priorityTitle: string;
  readonly priorityNote: string;
  readonly colFeature: string;
  readonly colPriority: string;
  readonly colVisible: string;
  readonly badge: string;
  /** Titre de groupe par priorité. */
  readonly groups: Readonly<Record<FeaturePriority, string>>;
}

/** Les 21 fonctionnalités, dans l'ordre du cahier des charges. */
export const FEATURES: Readonly<Record<Lang, readonly FeatureEntry[]>> = {
  en: FEATURES_EN,
  fr: FEATURES_FR,
};

export const FEATURES_STRINGS: Readonly<Record<Lang, FeaturesStrings>> = {
  en: {
    title: 'All 21 features, and where to see them',
    lede:
      'Everything the app does, taken from the specification (§14). Each row points to the part of this page where the feature actually runs: the demo executes the real engine, the mockups render the real screens.',
    priorityTitle: 'Priority',
    priorityNote: 'M = must have · S = should have · C = could have (specification §14).',
    colFeature: 'Feature',
    colPriority: 'Priority',
    colVisible: 'See it here',
    badge: 'See',
    groups: { M: 'Must have', S: 'Should have', C: 'Could have' },
  },
  fr: {
    title: 'Les 21 fonctionnalités, et où les voir',
    lede:
      'Tout ce que fait l’app, repris du cahier des charges (§14). Chaque ligne renvoie à l’endroit de cette page où la fonctionnalité tourne vraiment : la démo exécute le moteur réel, les maquettes rendent les vrais écrans.',
    priorityTitle: 'Priorité',
    priorityNote: 'M = indispensable · S = important · C = bonus (cahier des charges §14).',
    colFeature: 'Fonctionnalité',
    colPriority: 'Priorité',
    colVisible: 'Visible ici',
    badge: 'Voir',
    groups: { M: 'Indispensable', S: 'Important', C: 'Bonus' },
  },
};

/** Les fonctionnalités d'une priorité, dans l'ordre du cahier des charges. */
export function featuresOfPriority(
  lang: Lang,
  priority: FeaturePriority,
): readonly FeatureEntry[] {
  return FEATURES[lang].filter((feature) => feature.priority === priority);
}
