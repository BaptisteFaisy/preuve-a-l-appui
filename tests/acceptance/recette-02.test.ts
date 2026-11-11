/**
 * Recette SPEC §22 — points 2 et 3 : la CI tranche la force d'une preuve de test.
 *
 * Point 2 : un test attaché, présent et vert dans les résultats de CI de la
 *           branche, donne une preuve « vérifiée par machine » (SPEC §9.1).
 * Point 3 : le même test, absent ou en échec, ne donne aucune preuve valable.
 *
 * Trajet réel : `attachEvidence` (domaine, force calculée par l'app) pose une
 * preuve de test déclarée tant que la CI n'a pas parlé, puis le résumé de CI
 * arrive par `handleCiResults` → file → `onCiMessage` (lot L4) qui la confirme
 * ou l'invalide, et le moteur de couverture réel recalcule (SPEC §10, §17).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { CriterionState } from '../../src/types.js';
import {
  aCiSummary,
  aTestOutcome,
  COMMIT,
  DEVELOPER,
  TEST_REFUSAL,
} from '../helpers/builders.js';
import { createAcceptanceHarness, ISSUE_ID, type AcceptanceHarness } from './harness.js';

/** Attache sur AC-4 (critère nu) une preuve de test déclarée, sans CI encore. */
async function attachDeclaredTest(h: AcceptanceHarness): Promise<string> {
  const criterion = await h.scenario.store.getCriterion('crit-4');
  const result = await h.attachEvidence(
    {
      criterionId: 'crit-4',
      type: 'test',
      reference: TEST_REFUSAL,
      addedBy: DEVELOPER,
      commit: COMMIT,
    },
    {
      store: h.scenario.store,
      clock: h.scenario.clock,
      ids: h.scenario.ids,
      checker: h.scenario.checker,
    },
    criterion,
  );
  // Sans résultat de CI, la force retombe à « déclarée » (SPEC §9.1).
  expect(result.strength).toBe('declared');
  return result.evidence.id;
}

function stateOf(coverage: { criteria: readonly CriterionState[] } | null, id: string): CriterionState {
  const state = coverage?.criteria.find((c) => c.criterionId === id);
  if (!state) throw new Error(`critère absent de la couverture : ${id}`);
  return state;
}

describe('recette §22 — la CI tranche la preuve de test (points 2 et 3)', () => {
  it('recette-02 : un test attaché, vert dans la CI de la branche, devient « vérifié par machine »', async () => {
    const h = await createAcceptanceHarness();
    await attachDeclaredTest(h);

    // Avant CI : AC-4 exige une vérification machine, la déclaration ne suffit pas.
    await h.recompute(ISSUE_ID);
    expect(stateOf(await h.coverage.read(ISSUE_ID), 'crit-4').proven).toBe(false);

    // Le pipeline de la branche passe : le test est présent et vert.
    const response = await h.runCi(
      aCiSummary({
        commit: COMMIT,
        tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'passed' })],
      }),
    );
    expect(response.statusCode).toBe(202);

    const state = stateOf(await h.coverage.read(ISSUE_ID), 'crit-4');
    expect(state.proven).toBe(true);
    expect(state.bestStrength).toBe('machine-verified');
  });

  it('recette-03 : le même test en échec dans la CI ne donne aucune preuve valable', async () => {
    const h = await createAcceptanceHarness();
    await attachDeclaredTest(h);

    // Le pipeline de la branche échoue sur ce test.
    await h.runCi(
      aCiSummary({
        commit: COMMIT,
        tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })],
      }),
    );

    const state = stateOf(await h.coverage.read(ISSUE_ID), 'crit-4');
    expect(state.proven).toBe(false);
    expect(state.bestStrength).not.toBe('machine-verified');
    expect(state.defect).toBe('unverified');
  });

  it('recette-03 (variante) : le test absent des résultats de CI ne prouve rien', async () => {
    const h = await createAcceptanceHarness();
    await attachDeclaredTest(h);

    // Un pipeline qui ne contient pas le test attaché, sur le même commit.
    await h.runCi(
      aCiSummary({
        commit: COMMIT,
        tests: [aTestOutcome({ name: 'un autre test', state: 'passed' })],
      }),
    );

    const state = stateOf(await h.coverage.read(ISSUE_ID), 'crit-4');
    expect(state.proven).toBe(false);
    expect(state.bestStrength).not.toBe('machine-verified');
  });
});
