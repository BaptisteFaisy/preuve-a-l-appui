/**
 * Recette SPEC §22 — points 4 et 5 : l'indépendance de l'attestation.
 *
 * Point 4 : l'assigné ne peut pas attester ; un autre membre du projet le peut
 *           (SPEC §9.4). Prouvé avec le vrai module `canAttest` sur les acteurs
 *           réels du scénario PAY-123.
 * Point 5 : une preuve déclarée par un agent ne satisfait pas un critère
 *           exigeant une attestation (SPEC §9.1, §15, §19).
 *
 * Le point 4 révèle aussi un écart d'intégration réel (voir `it.fails` et la
 * section ÉCARTS du compte rendu) : le geste humain `attest-criterion` du
 * résolveur (lot L6) n'appelle pas `canAttest`, donc l'indépendance n'est pas
 * appliquée au moment de l'écriture. Le domaine reste juste ; le câblage manque.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { ActionError } from '../../src/handlers/dispatch.js';
import type { CriterionState } from '../../src/types.js';
import { DEVELOPER } from '../helpers/builders.js';
import { createAcceptanceHarness, ISSUE_ID, ISSUE_KEY } from './harness.js';

function stateOf(coverage: { criteria: readonly CriterionState[] } | null, id: string): CriterionState {
  const state = coverage?.criteria.find((c) => c.criterionId === id);
  if (!state) throw new Error(`critère absent de la couverture : ${id}`);
  return state;
}

describe('recette §22 — indépendance de l’attestation (point 4)', () => {
  it('recette-04 : l’assigné ne peut pas attester, un autre membre du projet le peut', async () => {
    const h = await createAcceptanceHarness();
    const { developer, tester, agent } = h.scenario.actors;
    const ac3 = h.scenario.criteria[2]; // AC-3, attestation exigée.

    // Le vrai module d'indépendance, sur les acteurs réels du scénario (§9.4).
    const assignee = h.canAttest(developer, h.scenario.issue, ac3, h.scenario.project);
    const peer = h.canAttest(tester, h.scenario.issue, ac3, h.scenario.project);
    const robot = h.canAttest(agent, h.scenario.issue, ac3, h.scenario.project);

    expect(assignee.allowed).toBe(false); // l'assignée ne peut pas
    expect(peer.allowed).toBe(true); // un autre membre du projet peut
    expect(robot.allowed).toBe(false); // un agent, jamais
  });

  // ÉCART d'intégration (SPEC §9.4) : `canAttest` n'est câblé ni dans le geste
  // humain `attest-criterion` (src/handlers/resolver.ts, lot L6) ni dans la
  // vue matricielle (`canAttest: !crit.proven`). Le résolveur écrit donc
  // l'attestation de l'assigné sans la refuser. Test attendu en échec tant que
  // le geste n'applique pas le domaine ; il redeviendra rouge une fois corrigé.
  it.fails('recette-04 ÉCART : le geste « attest-criterion » devrait refuser l’assigné', async () => {
    const h = await createAcceptanceHarness();
    const res = (await h.gesture('attest-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-3',
      note: 'auto-attestation de l’assignée',
      accountId: DEVELOPER,
    })) as { ok: boolean };
    expect(res.ok).toBe(false);
  });
});

describe('recette §22 — la déclaration d’un agent ne suffit pas (point 5)', () => {
  it('recette-05 : une preuve déclarée par l’agent ne satisfait pas AC-3 (attestation exigée)', async () => {
    const h = await createAcceptanceHarness();
    await h.recompute(ISSUE_ID);

    // AC-3 n'a que la déclaration d'agent du scénario : elle ne prouve rien.
    const state = stateOf(await h.coverage.read(ISSUE_ID), 'crit-3');
    expect(state.proven).toBe(false);
    expect(state.bestStrength).toBe('declared');
    expect(state.defect).toBe('weak-strength');
  });

  it('recette-05 (variante) : aucun outil MCP ne laisse un agent attester', async () => {
    const h = await createAcceptanceHarness();

    // L'agent tente d'attester via l'outil attach-evidence : refus explicite.
    await expect(
      h.tool(
        'attach-evidence',
        { issueKey: ISSUE_KEY, criterionId: 'crit-3', type: 'attestation', reference: 'manual' },
        h.mcpContext,
      ),
    ).rejects.toThrow(ActionError);

    // Une simple déclaration d'agent reste « declared », jamais « attested ».
    const declared = (await h.tool(
      'attach-evidence',
      { issueKey: ISSUE_KEY, criterionId: 'crit-3', type: 'agent-report', reference: 'report#ac-3' },
      h.mcpContext,
    )) as { strength: string; addedByAgent: boolean };
    expect(declared.strength).toBe('declared');
    expect(declared.addedByAgent).toBe(true);
  });
});
