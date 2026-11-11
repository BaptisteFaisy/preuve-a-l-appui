/**
 * Tests du view-model de couverture (SPEC §16.2, §12.3, FP-16).
 *
 * Vérifie le libellé « n / m », les couleurs (vert / orange / rouge), le cas
 * vide, et la traduction du statut. Logique pure, aucune UI.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { aCoverage } from '../../tests/helpers/builders.js';
import {
  buildCoverageFieldViewModel,
  computeCoverageTone,
  tagColorOfTone,
} from '../../src/viewmodel/coverage.js';

describe('computeCoverageTone', () => {
  it('est vert quand tous les critères sont prouvés', () => {
    expect(computeCoverageTone(4, 4)).toBe('green');
  });

  it('est orange quand la couverture est partielle', () => {
    expect(computeCoverageTone(3, 4)).toBe('orange');
    expect(computeCoverageTone(1, 4)).toBe('orange');
  });

  it('est rouge quand rien n’est prouvé', () => {
    expect(computeCoverageTone(0, 4)).toBe('red');
  });

  it('est rouge quand il n’y a aucun critère', () => {
    expect(computeCoverageTone(0, 0)).toBe('red');
  });
});

describe('tagColorOfTone', () => {
  it('associe vert→green, orange→yellow, rouge→red', () => {
    expect(tagColorOfTone('green')).toBe('green');
    expect(tagColorOfTone('orange')).toBe('yellow');
    expect(tagColorOfTone('red')).toBe('red');
  });
});

describe('buildCoverageFieldViewModel', () => {
  it('produit le libellé « 3 / 4 » pour une couverture partielle', () => {
    const vm = buildCoverageFieldViewModel(aCoverage({ proven: 3, total: 4 }), 'fr');
    expect(vm.label).toBe('3 / 4');
    expect(vm.tone).toBe('orange');
    expect(vm.tagColor).toBe('yellow');
  });

  it('est vert et « 4 / 4 » quand tout est prouvé', () => {
    const vm = buildCoverageFieldViewModel(aCoverage({ proven: 4, total: 4, passes: true }), 'en');
    expect(vm.label).toBe('4 / 4');
    expect(vm.tone).toBe('green');
    expect(vm.tagColor).toBe('green');
    expect(vm.passes).toBe(true);
  });

  it('rend « 0 / 0 » et rouge quand la couverture est absente', () => {
    const vm = buildCoverageFieldViewModel(null, 'fr');
    expect(vm.label).toBe('0 / 0');
    expect(vm.tone).toBe('red');
    expect(vm.total).toBe(0);
    expect(vm.passes).toBe(false);
  });

  it('rend « 0 / 0 » quand le total est nul', () => {
    const vm = buildCoverageFieldViewModel(aCoverage({ proven: 0, total: 0 }), 'fr');
    expect(vm.label).toBe('0 / 0');
  });

  it('traduit l’info-bulle selon la langue et le statut de blocage', () => {
    const blocked = buildCoverageFieldViewModel(
      aCoverage({ proven: 1, total: 4, passes: false }),
      'fr',
    );
    expect(blocked.tooltip).toContain('1 sur 4');
    expect(blocked.tooltip).toContain('Bloque la transition');

    const passing = buildCoverageFieldViewModel(
      aCoverage({ proven: 4, total: 4, passes: true }),
      'en',
    );
    expect(passing.tooltip).toContain('4 of 4');
    expect(passing.tooltip).toContain('Gate passes');
  });
});
