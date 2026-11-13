/**
 * La carte des fonctionnalités du site est testée, et surtout : elle ne peut
 * pas dériver du cahier des charges. Le test relit la table FP-01…FP-21 de
 * `docs/CAHIER-DES-CHARGES.md` (§14) et exige que le site rende exactement ces
 * codes, avec ces priorités, dans les deux langues.
 *
 * Une fonctionnalité ajoutée au cahier sans être montrée sur le site fait donc
 * échouer la CI — c'est le but (lot `site-toutes-features`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FEATURES, FEATURES_STRINGS, featuresOfPriority } from '../../site/src/i18n/features.js';
import type { FeatureEntry, FeaturePriority } from '../../site/src/i18n/features.js';

const SPEC = fileURLToPath(new URL('../../docs/CAHIER-DES-CHARGES.md', import.meta.url));

/** Les ancres de section qui existent réellement sur la page. */
const ANCHORS = new Set([
  '#problem',
  '#rule',
  '#features',
  '#demo',
  '#screens',
  '#agents',
  '#architecture',
  '#recipe',
  '#judges',
]);

/** La table du §14, telle qu'écrite dans le cahier des charges. */
function specRows(): { code: string; priority: FeaturePriority }[] {
  const rows: { code: string; priority: FeaturePriority }[] = [];
  for (const line of readFileSync(SPEC, 'utf8').split('\n')) {
    const match = /^\|\s*(FP-\d+)\s*\|(.+)\|\s*([MSC])\s*\|$/.exec(line);
    if (match !== null) {
      rows.push({ code: match[1] as string, priority: match[3] as FeaturePriority });
    }
  }
  return rows;
}

const codes = (entries: readonly FeatureEntry[]): string[] => entries.map((entry) => entry.code);

describe('carte des fonctionnalités du site', () => {
  it('rend exactement les codes du cahier des charges, dans le même ordre', () => {
    const spec = specRows();
    expect(spec.length).toBe(21);
    expect(codes(FEATURES.fr)).toEqual(spec.map((row) => row.code));
    expect(codes(FEATURES.en)).toEqual(spec.map((row) => row.code));
  });

  it('reprend la priorité du cahier des charges pour chaque fonctionnalité', () => {
    const spec = new Map(specRows().map((row) => [row.code, row.priority]));
    for (const lang of ['fr', 'en'] as const) {
      for (const entry of FEATURES[lang]) {
        expect(entry.priority, `${lang} ${entry.code}`).toBe(spec.get(entry.code));
      }
    }
  });

  it('groupe 12 indispensables, 6 importants et 3 bonus', () => {
    expect(featuresOfPriority('fr', 'M')).toHaveLength(12);
    expect(featuresOfPriority('fr', 'S')).toHaveLength(6);
    expect(featuresOfPriority('fr', 'C')).toHaveLength(3);
  });

  it('écrit un titre et une description dans les deux langues', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const entry of FEATURES[lang]) {
        expect(entry.title.trim().length, `${lang} ${entry.code}`).toBeGreaterThan(3);
        expect(entry.description.trim().length, `${lang} ${entry.code}`).toBeGreaterThan(20);
      }
    }
  });

  it('renvoie chaque fonctionnalité vers une ancre qui existe sur la page', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const entry of FEATURES[lang]) {
        expect(ANCHORS.has(entry.where), `${lang} ${entry.code} → ${entry.where}`).toBe(true);
      }
    }
  });

  it('montre au moins une fonctionnalité par section citée', () => {
    const targets = new Set(FEATURES.fr.map((entry) => entry.where));
    expect(targets.has('#demo')).toBe(true);
    expect(targets.has('#screens')).toBe(true);
    expect(targets.has('#agents')).toBe(true);
  });

  it('traduit les textes d’accompagnement de la section', () => {
    for (const lang of ['fr', 'en'] as const) {
      const t = FEATURES_STRINGS[lang];
      expect(t.title.length).toBeGreaterThan(5);
      expect(t.lede.length).toBeGreaterThan(20);
      expect(t.badge.length).toBeGreaterThan(1);
      expect(Object.keys(t.groups)).toEqual(['M', 'S', 'C']);
    }
  });
});
