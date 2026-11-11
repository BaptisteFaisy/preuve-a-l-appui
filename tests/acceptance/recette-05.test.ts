/**
 * Recette SPEC §22 — points 7 et 8 : la preuve « à revoir » / « à reconfirmer ».
 *
 * Point 7 : modifier le texte d'un critère fait passer ses preuves en
 *           « à revoir » (SPEC §8.4, FP-13).
 * Point 8 : un nouveau commit après une preuve de test la rend « à reconfirmer »
 *           jusqu'au passage vert suivant (SPEC §9.3).
 *
 * Trajet réel : `changeCriterionText` (domaine lot L1) écrit la version et marque
 * les preuves ; `onJiraEvent` (handler lot L4) recalcule la couverture ; un
 * résumé de CI arrive par `handleCiResults` → `onCiMessage` qui applique la
 * fraîcheur (`applyCiSummaryToEvidences`, domaine lot L4). Moteur réel.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { CriterionState } from '../../src/types.js';
import { aCiSummary, aTestOutcome, TEST_REFUSAL } from '../helpers/builders.js';
import { createAcceptanceHarness, ISSUE_ID, type AcceptanceHarness } from './harness.js';

const NEW_COMMIT = 'a1b2c3d4e5f60718293a';

function stateOf(coverage: { criteria: readonly CriterionState[] } | null, id: string): CriterionState {
  const state = coverage?.criteria.find((c) => c.criterionId === id);
  if (!state) throw new Error(`critère absent de la couverture : ${id}`);
  return state;
}

describe('recette §22 — modifier le texte d’un critère (point 7)', () => {
  it('recette-07 : un texte modifié passe les preuves du critère en « à revoir »', async () => {
    const h = await createAcceptanceHarness();
    const { store, clock, actors } = h.scenario;
    const crit1 = await store.getCriterion('crit-1');
    expect(crit1).not.toBeNull();

    const change = await h.changeCriterionText(
      {
        criterion: crit1!,
        newText: 'Le paiement par carte expirée est refusé, avec un message explicite',
        actor: actors.developer,
        language: 'fr',
      },
      {
        saveCriterion: (c) => store.saveCriterion(c),
        addCriterionRevision: (r) => store.addCriterionRevision(r),
        evidence: store,
        clock,
      },
    );

    expect(change.changed).toBe(true);
    expect(change.criterion.version).toBe(2);
    expect(change.toReconfirmEvidenceIds).toContain('ev-1');
    expect((await store.getEvidence('ev-1'))?.freshness).toBe('to-reconfirm');

    // L'événement Jira réel recalcule la couverture : la preuve ne compte plus.
    await h.emitIssueUpdated();
    const state = stateOf(await h.coverage.read(ISSUE_ID), 'crit-1');
    expect(state.proven).toBe(false);
    expect(state.defect).toBe('not-fresh');
  });
});

describe('recette §22 — un nouveau commit après une preuve de test (point 8)', () => {
  it('recette-08 : un nouveau commit rend la preuve « à reconfirmer » jusqu’au vert suivant', async () => {
    const h = await createAcceptanceHarness();
    await h.recompute(ISSUE_ID);
    // AC-1 est vérifiée par machine sur le commit initial.
    expect(stateOf(await h.coverage.read(ISSUE_ID), 'crit-1').bestStrength).toBe('machine-verified');

    // Un nouveau commit arrive, sans ré-exécuter le test : à reconfirmer (§9.3).
    await h.runCi(
      aCiSummary({
        commit: NEW_COMMIT,
        tests: [aTestOutcome({ name: 'un autre test', state: 'passed' })],
      }),
    );
    expect((await h.scenario.store.getEvidence('ev-1'))?.freshness).toBe('to-reconfirm');
    const after = stateOf(await h.coverage.read(ISSUE_ID), 'crit-1');
    expect(after.proven).toBe(false);
    expect(after.defect).toBe('not-fresh');

    // Le passage vert suivant, sur le nouveau commit, revalide la preuve.
    await h.runCi(
      aCiSummary({
        commit: NEW_COMMIT,
        tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'passed' })],
      }),
    );
    const reconfirmed = stateOf(await h.coverage.read(ISSUE_ID), 'crit-1');
    expect(reconfirmed.proven).toBe(true);
    expect(reconfirmed.bestStrength).toBe('machine-verified');
  });
});

/** Garde-fou : le harnais expose bien un moteur de couverture réel. */
describe('recette §22 — cohérence du harnais', () => {
  it('le moteur de couverture câblé recalcule et stocke la ligne lue par le validateur', async () => {
    const h: AcceptanceHarness = await createAcceptanceHarness();
    const coverage = await h.recompute(ISSUE_ID);
    expect(coverage?.issueId).toBe(ISSUE_ID);
    expect(await h.coverage.read(ISSUE_ID)).not.toBeNull();
  });
});
