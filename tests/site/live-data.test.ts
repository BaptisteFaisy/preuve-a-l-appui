/**
 * La démo branchée sur les données réelles de l'app installée.
 *
 * Le fichier `tests/fixtures/live-snapshot.json` est une réponse réelle du web
 * trigger `demo-data` (site de démonstration Jira), figée pour que les tests
 * ne dépendent pas du réseau. Ces tests prouvent que le site rejoue le vrai
 * moteur sur cet instantané : mêmes critères, mêmes forces, même couverture,
 * mêmes acteurs — et que la repli sur le jeu embarqué fonctionne.
 *
 * Lot `site-donnees-reelles`. Règle : fichiers < 500 lignes, fonctions < 50.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DemoSnapshotData } from '../../src/demo-contract.js';
import { createLiveScenario, liveCast } from '../../site/src/demo/live-world.js';
import { bundledSnapshot, isSnapshot } from '../../site/src/demo/live-snapshot.js';
import { snapshotOf } from '../../site/src/demo/state.js';
import { createWorld } from '../../site/src/demo/world.js';
import { buildProjectPageViewModel } from '../../src/viewmodel/project.js';

const FIXTURE = fileURLToPath(new URL('../../site/public/live-snapshot.json', import.meta.url));

/** L'instantané réel, tel que l'app l'a servi. */
function snapshot(): DemoSnapshotData {
  const parsed: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  if (!isSnapshot(parsed)) throw new Error('fixture invalide');
  return parsed;
}

describe('lecture des données réelles', () => {
  it('embarque le même instantané que le site public', () => {
    expect(bundledSnapshot()).not.toBeNull();
    expect(bundledSnapshot()?.issue.key).toBe('PRF-1');
  });

  it('reconnaît un instantané et refuse autre chose', () => {
    expect(isSnapshot(snapshot())).toBe(true);
    expect(isSnapshot(null)).toBe(false);
    expect(isSnapshot({ issue: {} })).toBe(false);
    expect(isSnapshot('texte')).toBe(false);
  });

  it('porte les données du ticket lu dans Jira', () => {
    const data = snapshot();
    expect(data.issue.key).toBe('PRF-1');
    expect(data.criteria).toHaveLength(4);
    expect(data.criteria.map((criterion) => criterion.code)).toEqual([
      'AC-1',
      'AC-2',
      'AC-3',
      'AC-4',
    ]);
    expect(data.coverage?.total).toBe(4);
    expect(data.coverage?.proven).toBe(2);
  });

  it('ne contient aucun identifiant de compte', () => {
    const raw = readFileSync(FIXTURE, 'utf8');
    expect(raw).not.toContain('712020:');
    expect(raw).not.toContain('qm:');
  });
});

describe('monde bâti sur les données réelles', () => {
  it('nomme les acteurs : l’assignée, l’agent, la testeuse, le product owner', async () => {
    const data = snapshot();
    const cast = liveCast(data);
    expect(cast.developer.accountId).toBe(data.issue.assigneeRef);
    expect(cast.developer.agent).toBe(false);
    expect(cast.agent.agent).toBe(true);
    expect(cast.tester.displayName).not.toBe('');
    expect(cast.owner.displayName).not.toBe('');
  });

  it('rejoue le moteur sur ces données : la matrice et la couverture suivent', async () => {
    const data = snapshot();
    const scenario = await createLiveScenario(data, 'fr');
    const world = await createWorld(scenario);
    const snapshotOfWorld = await snapshotOf(
      world,
      world.scenario.actors.tester,
      'strict',
      'fr',
      null,
      [],
      false,
    );
    expect(snapshotOfWorld.issueKey).toBe('PRF-1');
    expect(snapshotOfWorld.field.label).toBe('2 / 4');
    expect(snapshotOfWorld.matrix.rows).toHaveLength(4);
    expect(snapshotOfWorld.source.kind).toBe('live');
    expect(snapshotOfWorld.source.site).toBe(data.site);
  });

  it('ne prouve rien de plus que les données réelles : l’assignée ne peut pas attester', async () => {
    const data = snapshot();
    const scenario = await createLiveScenario(data, 'fr');
    const world = await createWorld(scenario);
    const asAssignee = await snapshotOf(
      world,
      world.scenario.actors.developer,
      'strict',
      'fr',
      null,
      [],
      false,
    );
    const attestable = asAssignee.matrix.rows.filter((row) => row.canAttest);
    expect(attestable).toHaveLength(0);
  });
});

describe('les deux finitions, portées par les données réelles', () => {
  it('le récap « dérogations par personne » nomme l’accordeur sans identifiant', () => {
    const data = snapshot();
    // Deux personnes ont dérogé, pour trois dérogations : le récap compte
    // par personne, comme le veut la mesure (SPEC §14 FP-18).
    expect(data.stats?.waiversByGranter).toEqual([
      { accountId: expect.any(String), displayName: 'John Doe', count: 2 },
      { accountId: expect.any(String), displayName: 'Alison Swift', count: 1 },
    ]);
    const raw = JSON.stringify(data.stats);
    expect(raw).not.toContain('qm:');
    expect(raw).not.toContain('712020:');
  });

  it('les réouvertures sont lues dans l’historique Jira, pas laissées à zéro', () => {
    const data = snapshot();
    const machine = data.stats?.reopenings.find((rate) => rate.strength === 'machine-verified');
    // Au moins un ticket livré, dont au moins un rouvert : c'est PRF-7, livré
    // puis rouvert quand son test a disparu de la branche principale.
    expect(machine?.closed).toBeGreaterThan(0);
    expect(machine?.reopened).toBeGreaterThan(0);
  });

  it('la preuve vivante réelle porte un critère livré qui n’est plus prouvé', () => {
    const data = snapshot();
    const unproven = data.living.filter((item) => item.state !== 'proven');
    expect(unproven.length).toBeGreaterThan(0);
    expect(unproven.every((item) => item.issueKey.startsWith('PRF-'))).toBe(true);
  });

  it('la page projet bâtie sur l’instantané montre le récap et les preuves vivantes', () => {
    const data = snapshot();
    const names = new Map(data.actors.map((actor) => [actor.ref, actor.displayName]));
    const vm = buildProjectPageViewModel({
      projectId: data.issue.projectKey,
      coverages: data.coverage === null ? [] : [data.coverage],
      waivers: data.waivers,
      living: data.living,
      stats: data.stats,
      language: 'fr',
    });
    // Le récap se rend avec le nom résolu, jamais l'identifiant.
    expect(vm.stats?.waiversByGranter[0]?.displayName).toBe('John Doe');
    const ref = vm.stats?.waiversByGranter[0]?.accountId ?? '';
    expect(names.get(ref)).toBe('John Doe');
    // Les preuves vivantes dégradées sont listées.
    expect(vm.unprovenLivingCount).toBeGreaterThan(0);
  });
});
