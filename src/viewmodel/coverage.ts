/**
 * ViewModel pur pour le champ de couverture (SPEC §16.2, §12.3, FP-16).
 *
 * Libellé « n / m » coloré (vert / orange / rouge), lecture seule.
 * Les couleurs du design system Atlassian n'ont pas d'orange : le Tag
 * « yellow » joue ce rôle (couverture partielle). Toute la logique de
 * couleur et de libellé vit ici, testable sans UI.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { text } from '../i18n/index.js';
import { UI_MESSAGES } from '../i18n/ui.js';
import type { Coverage, Language } from '../types.js';

export type CoverageColorTone = 'green' | 'orange' | 'red';

/** Couleur de Tag : vert = complet, jaune = partiel, rouge = vide/bloquant. */
export type CoverageTagColor = 'green' | 'yellow' | 'red';

export interface CoverageFieldViewModel {
  readonly label: string;
  readonly proven: number;
  readonly total: number;
  readonly ratio: number;
  readonly tone: CoverageColorTone;
  readonly tagColor: CoverageTagColor;
  readonly tooltip: string;
  readonly passes: boolean;
}

/** Vert si tout est prouvé, orange si partiel, rouge si rien (SPEC §16.2). */
export function computeCoverageTone(proven: number, total: number): CoverageColorTone {
  if (total <= 0) return 'red';
  if (proven >= total) return 'green';
  if (proven > 0) return 'orange';
  return 'red';
}

export function tagColorOfTone(tone: CoverageColorTone): CoverageTagColor {
  if (tone === 'green') return 'green';
  if (tone === 'orange') return 'yellow';
  return 'red';
}

export function buildCoverageFieldViewModel(
  coverage: Coverage | null,
  language: Language,
): CoverageFieldViewModel {
  if (!coverage || coverage.total === 0) {
    const emptyLabel = text(UI_MESSAGES, 'ui.coverage.empty', language);
    return {
      label: emptyLabel,
      proven: 0,
      total: 0,
      ratio: 0,
      tone: 'red',
      tagColor: 'red',
      tooltip: emptyLabel,
      passes: false,
    };
  }

  const { proven, total, passes } = coverage;
  const tone = computeCoverageTone(proven, total);
  const statusKey = passes ? 'ui.coverage.passes' : 'ui.coverage.blocks';
  const statusText = text(UI_MESSAGES, statusKey, language);

  return {
    label: `${proven} / ${total}`,
    proven,
    total,
    ratio: total > 0 ? proven / total : 0,
    tone,
    tagColor: tagColorOfTone(tone),
    tooltip: text(UI_MESSAGES, 'ui.coverage.tooltip', language, {
      proven,
      total,
      status: statusText,
    }),
    passes,
  };
}
