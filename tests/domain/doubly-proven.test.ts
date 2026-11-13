/**
 * La preuve « doublement prouvée » (SPEC §9.1, §9.4).
 *
 * Deux preuves indépendantes pour un même critère : une vérifiée par la
 * machine (un test) ET une attestée par un humain. C'est une information
 * **additive** : la force reste `declared` / `attested` / `machine-verified`,
 * donc le barème, les statistiques et le dossier ne bougent pas.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  isDoubleProven,
  isDoublyProven,
  proofSourcesOf,
} from '../../src/domain/strength.js';
import { buildCoverage, evaluateCriterionState } from '../../src/domain/coverage.js';
import { buildMatrixViewModel } from '../../src/viewmodel/matrix.js';
import { buildProjectPageViewModel } from '../../src/viewmodel/project.js';
import { buildDemoSnapshot } from '../../src/demo-snapshot.js';
import { toSnapshotDossier } from '../../src/demo-snapshot.js';
import type { Criterion, Evidence } from '../../src/types.js';
import { FIXED_NOW } from '../helpers/fake-clock.js';
import { aCriterion, aWaiver, settings } from '../helpers/builders.js';
import { coverage, dossier, dossierIssue, testEvidence } from '../db/fixtures.js';
import { createPay123Scenario } from '../helpers/scenario.js';
import { ISSUE_KEY } from '../helpers/builders.js';
import { NOW_ISO } from '../ingest/ci-deps.js';

/** Une attestation humaine fraîche, vérifiée, de force `attested`. */
function attestationEvidence(partial: Partial<Evidence> = {}): Evidence {
  return testEvidence({
    id: 'ev-att',
    type: 'attestation',
    reference: 'manual-check',
    strength: 'attested',
    commit: '',
    ...partial,
  });
}

const CRITERION = aCriterion({ id: 'crit-dp', code: 'AC-DP', version: 1 } as Partial<Criterion>);

describe('isDoubleProven — le domaine', () => {
  it('vrai seulement quand une preuve machine ET une attestation coexistent', () => {
    const both = [testEvidence({ criterionId: 'crit-dp' }), attestationEvidence({ criterionId: 'crit-dp' })];
    expect(isDoubleProven(both, 'crit-dp', 1)).toBe(true);
  });

  it('faux avec une seule source : un test seul, ou une attestation seule', () => {
    expect(isDoubleProven([testEvidence({ criterionId: 'crit-dp' })], 'crit-dp', 1)).toBe(false);
    expect(
      isDoubleProven([attestationEvidence({ criterionId: 'crit-dp' })], 'crit-dp', 1),
    ).toBe(false);
  });

  it('faux quand la preuve machine est périmée ou non vérifiée', () => {
    const stale = [
      testEvidence({ criterionId: 'crit-dp', freshness: 'to-reconfirm' }),
      attestationEvidence({ criterionId: 'crit-dp' }),
    ];
    expect(isDoubleProven(stale, 'crit-dp', 1)).toBe(false);
    const unverified = [
      testEvidence({ criterionId: 'crit-dp', verified: false }),
      attestationEvidence({ criterionId: 'crit-dp' }),
    ];
    expect(isDoubleProven(unverified, 'crit-dp', 1)).toBe(false);
  });

  it('faux quand la preuve porte sur une version antérieure du critère', () => {
    const old = [
      testEvidence({ criterionId: 'crit-dp', criterionVersion: 1 }),
      attestationEvidence({ criterionId: 'crit-dp', criterionVersion: 1 }),
    ];
    expect(isDoubleProven(old, 'crit-dp', 2)).toBe(false);
  });

  it('faux quand la preuve a été remplacée (intégrité, SPEC §20)', () => {
    const replaced = [
      testEvidence({ criterionId: 'crit-dp', replacedBy: 'ev-next' }),
      attestationEvidence({ criterionId: 'crit-dp' }),
    ];
    expect(isDoubleProven(replaced, 'crit-dp', 1)).toBe(false);
  });

  it('nomme les deux sources trouvées', () => {
    const evidences = [
      testEvidence({ criterionId: 'crit-dp' }),
      attestationEvidence({ criterionId: 'crit-dp' }),
    ];
    expect(proofSourcesOf(evidences, 'crit-dp', 1)).toEqual({ machine: true, human: true });
    expect(proofSourcesOf([], 'crit-dp', 1)).toEqual({ machine: false, human: false });
  });

  it('isDoublyProven recalcule depuis les preuves une ligne lue en base', () => {
    const evidences = [
      testEvidence({ criterionId: 'crit-dp' }),
      attestationEvidence({ criterionId: 'crit-dp' }),
    ];
    // Ligne ancienne, sans le champ : le verdict se recalcule.
    expect(isDoublyProven({ criterionId: 'crit-dp', version: 1, evidences })).toBe(true);
    // Le champ posé par le domaine est respecté tel quel.
    expect(isDoublyProven({ criterionId: 'x', version: 1, evidences: [], doublyProven: true })).toBe(true);
  });
});

describe('CriterionState et matrice', () => {
  const input = {
    criterion: CRITERION,
    waivers: [],
    settings: settings(),
    now: FIXED_NOW,
  };

  it('l’état du critère porte `doublyProven`, et la force ne change pas', () => {
    const state = evaluateCriterionState({
      ...input,
      evidences: [
        testEvidence({ criterionId: 'crit-dp' }),
        attestationEvidence({ criterionId: 'crit-dp' }),
      ],
    });
    expect(state.doublyProven).toBe(true);
    // Additif : la meilleure force reste celle du test, pas un quatrième niveau.
    expect(state.bestStrength).toBe('machine-verified');
    expect(state.proven).toBe(true);
  });

  it('un critère à une seule preuve n’est pas doublement prouvé', () => {
    const state = evaluateCriterionState({
      ...input,
      evidences: [testEvidence({ criterionId: 'crit-dp' })],
    });
    expect(state.doublyProven).toBe(false);
  });

  it('la couverture complète porte l’information, sans toucher au barème', () => {
    const cov = buildCoverage({
      issueId: '10001',
      issueKey: ISSUE_KEY,
      criteria: [CRITERION],
      evidences: [
        testEvidence({ criterionId: 'crit-dp' }),
        attestationEvidence({ criterionId: 'crit-dp' }),
      ],
      waivers: [],
      settings: settings(),
      now: FIXED_NOW,
    });
    expect(cov.criteria[0]?.doublyProven).toBe(true);
    // Barème inchangé : un critère prouvé sur un total d'un.
    expect(cov.total).toBe(1);
    expect(cov.proven).toBe(1);
  });

  it('le view-model de la matrice expose la ligne et son compte', () => {
    const cov = coverage({
      total: 2,
      proven: 2,
      criteria: [
        evaluateCriterionState({
          ...input,
          evidences: [
            testEvidence({ criterionId: 'crit-dp' }),
            attestationEvidence({ criterionId: 'crit-dp' }),
          ],
        }),
        evaluateCriterionState({
          ...input,
          criterion: aCriterion({ id: 'crit-simple', code: 'AC-2' }),
          evidences: [testEvidence({ criterionId: 'crit-simple' })],
        }),
      ],
    });
    const vm = buildMatrixViewModel(cov, 'fr');
    expect(vm.doublyProvenCount).toBe(1);
    expect(vm.rows.find((row) => row.code === 'AC-DP')?.doublyProven).toBe(true);
    expect(vm.rows.find((row) => row.code === 'AC-DP')?.doublyProvenLabel).toBe('Doublement prouvé');
    expect(vm.rows.find((row) => row.code === 'AC-2')?.doublyProvenLabel).toBe('');
  });

  it('la matrice vide compte zéro', () => {
    expect(buildMatrixViewModel(null, 'en').doublyProvenCount).toBe(0);
  });
});

describe('page projet — le marqueur discret', () => {
  it('compte les critères doublement prouvés du ticket et traduit le marqueur', () => {
    const cov = coverage({
      criteria: [
        {
          ...coverage().criteria[0]!,
          criterionId: 'crit-dp',
          doublyProven: true,
        },
      ],
    });
    const vm = buildProjectPageViewModel({
      projectId: '10000',
      coverages: [cov],
      waivers: [aWaiver()],
      living: [],
      stats: null,
      language: 'fr',
    });
    expect(vm.issues[0]?.doublyProvenCount).toBe(1);
    expect(vm.issues[0]?.doublyProvenLabel).toBe('1 doublement prouvés');
  });

  it('n’affiche rien quand aucun critère n’est doublement prouvé', () => {
    const plain = coverage();
    const vm = buildProjectPageViewModel({
      projectId: '10000',
      coverages: [plain],
      waivers: [],
      living: [],
      stats: null,
      language: 'en',
    });
    expect(vm.issues[0]?.doublyProvenLabel).toBe('');
  });
});

describe('instantané public — le transport sans casser les 32 768 octets', () => {
  it('chaque ticket du dossier porte son compte de critères doublement prouvés', () => {
    const state = {
      ...dossierIssue().criteria[0]!,
      doublyProven: true,
    };
    const view = toSnapshotDossier(
      dossier({ issues: [dossierIssue({ criteria: [state, state] })], versionId: '2.4' }),
    );
    expect(view.issues[0]?.doublyProven).toBe(2);
    // Le détail des critères reste hors de l'instantané : un seul entier suffit.
    expect(Object.keys(view.issues[0] ?? {})).not.toContain('criteria');
  });

  it('l’instantané d’un ticket doublement prouvé reste sous la limite Jira', async () => {
    const scenario = await createPay123Scenario(NOW_ISO);
    const snapshot = await buildDemoSnapshot(
      { store: scenario.store, jira: scenario.jira, clock: scenario.clock },
      { issueKey: ISSUE_KEY, site: 'demo.exemple' },
    );
    expect(snapshot).not.toBeNull();
    expect(JSON.stringify(snapshot).length).toBeLessThan(32_768);
  });
});
