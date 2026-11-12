/**
 * La démo du site public est testée comme le reste : elle assemble les VRAIS
 * modules de l'app sur les fakes en mémoire, donc ces tests prouvent à la fois
 * que la démo fonctionne et qu'elle ne ment pas sur le comportement de l'app.
 *
 * Même scénario que la recette du SPEC §22, joué depuis `site/src/demo/`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  agentTriesToAttest,
  askAgent,
  attest,
  runPipeline,
  setLanguage,
  setMode,
  tryDone,
  waive,
} from '../../site/src/demo/actions.js';
import { snapshotOf } from '../../site/src/demo/state.js';
import { createDemoWorld, ISSUE_ID, PROJECT_ID, type DemoWorld } from '../../site/src/demo/world.js';
import type { Actor } from '../../src/types.js';

/** Monde de démo prêt à jouer, en français, mode strict. */
async function world(): Promise<DemoWorld> {
  const built = await createDemoWorld();
  await setLanguage(built, 'fr');
  await built.recompute();
  return built;
}

function idOf(built: DemoWorld, name: 'developer' | 'tester' | 'owner' | 'agent'): string {
  const actor: Actor = built.scenario.actors[name];
  return actor.accountId;
}

describe('démo du site — état initial', () => {
  it('démarre sur PAY-123 avec deux preuves sur quatre', async () => {
    const built = await world();
    const snapshot = await snapshotOf(built, built.scenario.actors.tester, 'strict', 'fr', null, [], false);
    expect(snapshot.matrix.issueKey).toBe('PAY-123');
    expect(snapshot.field.label).toBe('2 / 4');
    expect(snapshot.matrix.rows).toHaveLength(4);
  });

  it('bloque la transition et nomme les critères en défaut', async () => {
    const built = await world();
    const verdict = await tryDone(built);
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toContain('AC-3');
    expect(verdict.errorMessage).toContain('AC-4');
  });
});

describe('démo du site — indépendance et dérogation (SPEC §9.4, §12.4)', () => {
  it('refuse l’assignée, accepte la testeuse', async () => {
    const built = await world();
    const refused = await attest(built, 'crit-3', idOf(built, 'developer'));
    expect(refused.outcome).toBe('refused');

    const allowed = await attest(built, 'crit-3', idOf(built, 'tester'));
    expect(allowed.outcome).toBe('ok');
    const snapshot = await snapshotOf(built, built.scenario.actors.tester, 'strict', 'fr', null, [], false);
    expect(snapshot.field.label).toBe('3 / 4');
  });

  it('refuse une dérogation hors rôle, l’accepte motivée par le PO', async () => {
    const built = await world();
    const refused = await waive(built, 'crit-4', 'Reporté dans PAY-140', idOf(built, 'developer'));
    expect(refused.outcome).toBe('refused');

    const empty = await waive(built, 'crit-4', '   ', idOf(built, 'owner'));
    expect(empty.outcome).toBe('refused');

    const granted = await waive(built, 'crit-4', 'Reporté dans PAY-140', idOf(built, 'owner'));
    expect(granted.outcome).toBe('ok');

    // AC-3 reste sans attestation : la dérogation seule ne suffit pas.
    const stillBlocked = await tryDone(built);
    expect(stillBlocked.result).toBe(false);
    expect(stillBlocked.errorMessage).toContain('AC-3');

    await attest(built, 'crit-3', idOf(built, 'tester'));
    expect((await tryDone(built)).result).toBe(true);
  });
});

describe('démo du site — CI et agent (SPEC §10, §15)', () => {
  it('un pipeline vert tient les preuves, un test désactivé les fait tomber', async () => {
    const built = await world();
    const green = await runPipeline(built, false);
    expect(green.detail).toContain('2 / 4');

    const summary = { ...built.scenario.ciSummary, tests: built.scenario.ciSummary.tests.map((t, i) => (i === 1 ? { ...t, state: 'skipped' as const } : t)) };
    await built.ci({ runId: 'run-demo-off', projectId: PROJECT_ID, summary });
    const after = await built.recompute();
    expect(after?.proven ?? 0).toBeLessThan(2);
  });

  it('l’agent lit le même état et ne peut pas attester', async () => {
    const built = await world();
    const answer = await askAgent(built, idOf(built, 'agent'));
    expect(answer.detail).toContain('2 / 4');

    const attempt = await agentTriesToAttest(built, 'crit-3', idOf(built, 'agent'));
    expect(attempt.outcome).toBe('refused');
  });

  it('un test en échec ne donne aucune preuve valable (SPEC §22 point 3)', async () => {
    const built = await world();
    const failing = built.scenario.ciSummary.tests.map((outcome, index) =>
      index === 0 ? { ...outcome, state: 'failed' as const } : outcome,
    );
    await built.ci({
      runId: 'run-demo-red',
      projectId: PROJECT_ID,
      summary: { ...built.scenario.ciSummary, tests: failing },
    });
    const after = await built.recompute();
    expect(after?.proven ?? 2).toBe(1);

    // Le test redevient vert : la preuve remonte aussitôt.
    await runPipeline(built, false);
    expect((await built.recompute())?.proven).toBe(2);
  });
});

describe('démo du site — modes du projet (SPEC §12.2)', () => {
  it('le mode observation laisse passer et le dit', async () => {
    const built = await world();
    await setMode(built, 'observe');
    await built.recompute();
    const verdict = await tryDone(built, 'observe');
    expect(verdict.result).toBe(true);
    const coverage = await built.coverage();
    expect(coverage?.wouldBlock).toBe(true);
  });

  it('change de langue sans perdre la couverture', async () => {
    const built = await world();
    await setLanguage(built, 'en');
    await built.recompute();
    const snapshot = await snapshotOf(built, built.scenario.actors.tester, 'strict', 'en', null, [], false);
    expect(snapshot.field.label).toBe('2 / 4');
    expect(snapshot.matrix.rows[0]?.requiredStrengthLabel.length).toBeGreaterThan(0);
    expect(ISSUE_ID).toBe('10001');
  });
});
