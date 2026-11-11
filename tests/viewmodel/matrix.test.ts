/**
 * Tests du view-model de la matrice critères × preuves (SPEC §16.1, FP-10).
 *
 * Vérifie la construction depuis une couverture, les statuts, le tri des
 * critères en défaut, les libellés « n / m », le formatage des preuves et de
 * l’historique, et la traduction anglais/français. Logique pure.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  aCoverage,
  aCriterionRevision,
  aCriterionState,
  anEvidence,
} from '../../tests/helpers/builders.js';
import {
  buildMatrixRow,
  buildMatrixViewModel,
  formatEvidenceItem,
  formatRevisionItem,
  resolveLozengeAppearance,
  resolveStatusKind,
  sortRowsByDefect,
} from '../../src/viewmodel/matrix.js';

describe('resolveStatusKind', () => {
  it('est « proven » quand le critère est prouvé', () => {
    expect(resolveStatusKind(aCriterionState({ proven: true }))).toBe('proven');
  });

  it('est « waived » quand le critère est dérogé et non prouvé', () => {
    expect(resolveStatusKind(aCriterionState({ proven: false, waived: true }))).toBe('waived');
  });

  it('est « to-reconfirm » quand une preuve doit être reconfirmée', () => {
    const state = aCriterionState({
      proven: false,
      defect: 'not-fresh',
      evidences: [anEvidence({ freshness: 'to-reconfirm' })],
    });
    expect(resolveStatusKind(state)).toBe('to-reconfirm');
  });

  it('est « missing » quand aucune preuve ne satisfait l’exigence', () => {
    expect(resolveStatusKind(aCriterionState({ proven: false, waived: false, defect: 'no-evidence', evidences: [] }))).toBe('missing');
  });
});

describe('resolveLozengeAppearance', () => {
  it('mappe les statuts vers les couleurs de lozenge', () => {
    expect(resolveLozengeAppearance('proven')).toBe('success');
    expect(resolveLozengeAppearance('waived')).toBe('moved');
    expect(resolveLozengeAppearance('to-reconfirm')).toBe('inprogress');
    expect(resolveLozengeAppearance('missing')).toBe('removed');
  });
});

describe('buildMatrixRow', () => {
  it('traduit le type, la force exigée et le statut en français', () => {
    const row = buildMatrixRow(
      aCriterionState({ type: 'security', requiredStrength: 'attested', proven: true }),
      'fr',
    );
    expect(row.typeLabel).toBe('Sécurité');
    expect(row.requiredStrengthLabel).toBe('Attesté');
    expect(row.statusLabel).toBe('Prouvé');
  });

  it('interdit l’attestation et la dérogation sur un critère déjà prouvé', () => {
    const row = buildMatrixRow(aCriterionState({ proven: true }), 'en');
    expect(row.canAttest).toBe(false);
    expect(row.canWaive).toBe(false);
  });

  it('autorise attestation et dérogation sur un critère non prouvé', () => {
    const row = buildMatrixRow(aCriterionState({ proven: false, waived: false }), 'en');
    expect(row.canAttest).toBe(true);
    expect(row.canWaive).toBe(true);
    expect(row.canAttach).toBe(true);
  });

  it('interdit la dérogation sur un critère déjà dérogé', () => {
    const row = buildMatrixRow(aCriterionState({ proven: false, waived: true }), 'en');
    expect(row.canWaive).toBe(false);
  });

  it('formate les preuves avec force colorée et fraîcheur', () => {
    const row = buildMatrixRow(
      aCriterionState({
        evidences: [anEvidence({ type: 'test', strength: 'machine-verified', freshness: 'fresh' })],
      }),
      'en',
    );
    expect(row.evidences).toHaveLength(1);
    expect(row.evidences[0]?.strengthColor).toBe('green');
    expect(row.evidences[0]?.strengthLabel).toBe('Machine-verified');
  });
});

describe('formatEvidenceItem', () => {
  it('traduit le type de preuve et la fraîcheur', () => {
    const item = formatEvidenceItem(anEvidence({ type: 'agent-report', freshness: 'stale' }), 'fr');
    expect(item.typeLabel).toBe('Compte rendu d’agent');
    expect(item.freshnessLabel).toBe('Périmé');
    expect(item.strengthColor).toBe('grey');
  });
});

describe('buildMatrixViewModel', () => {
  it('construit le résumé « n / m » depuis une couverture', () => {
    const vm = buildMatrixViewModel(
      aCoverage({
        total: 4,
        proven: 3,
        waived: 1,
        criteria: [aCriterionState({ code: 'AC-1', proven: true })],
      }),
      'fr',
    );
    expect(vm.summaryText).toBe('3 sur 4 critères prouvés');
    expect(vm.waivedText).toBe('(1 dérogés)');
    expect(vm.hasCriteria).toBe(true);
    expect(vm.rows).toHaveLength(1);
  });

  it('rend un état vide et sans critère quand la couverture est absente', () => {
    const vm = buildMatrixViewModel(null, 'en', 'PAY-123');
    expect(vm.hasCriteria).toBe(false);
    expect(vm.rows).toHaveLength(0);
    expect(vm.issueKey).toBe('PAY-123');
    expect(vm.summaryText).toContain('No acceptance criteria');
  });

  it('compte les critères en défaut', () => {
    const vm = buildMatrixViewModel(
      aCoverage({
        total: 2,
        proven: 1,
        criteria: [
          aCriterionState({ code: 'AC-1', proven: true, defect: null }),
          aCriterionState({ code: 'AC-2', proven: false, defect: 'no-evidence' }),
        ],
      }),
      'en',
    );
    expect(vm.defectsCount).toBe(1);
  });
});

describe('sortRowsByDefect', () => {
  it('place les critères non prouvés avant les prouvés, puis trie par code', () => {
    const proven = buildMatrixRow(aCriterionState({ code: 'AC-1', proven: true }), 'en');
    const missingB = buildMatrixRow(aCriterionState({ code: 'AC-3', proven: false }), 'en');
    const missingA = buildMatrixRow(aCriterionState({ code: 'AC-2', proven: false }), 'en');
    const sorted = sortRowsByDefect([proven, missingB, missingA]);
    expect(sorted.map((r) => r.code)).toEqual(['AC-2', 'AC-3', 'AC-1']);
  });
});

describe('formatRevisionItem', () => {
  it('produit un libellé avec version, auteur et date', () => {
    const item = formatRevisionItem(
      aCriterionRevision({ version: 2, changedBy: 'user-dev', at: '2026-11-11T08:00:00.000Z' }),
      'AC-1',
      'fr',
    );
    expect(item.version).toBe(2);
    expect(item.dateFormatted).toBe('2026-11-11');
    expect(item.label).toContain('v2');
    expect(item.label).toContain('user-dev');
  });
});
