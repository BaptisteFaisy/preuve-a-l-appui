/**
 * Les deux maquettes supplémentaires du site sont testées comme le reste :
 * sur les VRAIS view-models de l'app (`src/viewmodel/settings.ts`,
 * `src/viewmodel/project.ts`), pas sur le JSX. On prouve que les réglages
 * rendent la grille complète (FP-05), que la page projet rend tickets,
 * dérogations, preuves vivantes (FP-19) et statistiques (FP-18), et que les
 * textes du site (`screens-extra.ts`) existent en FR et en EN avec le même
 * jeu de clés.
 *
 * Lot `site-toutes-features`. Règle : fichiers < 500 lignes, fonctions < 50.
 */
import { describe, expect, it } from 'vitest';
import { CRITERION_TYPES } from '../../src/types.js';
import { createDemoSettings, DEMO_ISSUE_KEY, DEMO_PROJECT_ID } from '../../src/sample/pay-123.js';
import { buildSettingsViewModel, generateCiCommand } from '../../src/viewmodel/settings.js';
import { buildProjectPageViewModel } from '../../src/viewmodel/project.js';
import { createProjectDemoData } from '../../site/src/sections/parts/ProjectPageMock.js';
import { reopeningShare } from '../../src/domain/stats.js';
import { SCREENS_EXTRA } from '../../site/src/i18n/screens-extra.js';

describe('réglages du projet — view-model réel sur le sample', () => {
  const vm = buildSettingsViewModel(createDemoSettings(), DEMO_PROJECT_ID, 'fr');

  it('rend trois modes de validateur dont un seul sélectionné', () => {
    expect(vm.modeOptions).toHaveLength(3);
    expect(vm.modeOptions.filter((o) => o.isSelected)).toHaveLength(1);
    expect(vm.modeOptions.find((o) => o.isSelected)?.value).toBe('strict');
    for (const option of vm.modeOptions) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it('rend une ligne d’exigence par type de critère (FP-05)', () => {
    expect(vm.requirements).toHaveLength(CRITERION_TYPES.length);
    expect(vm.requirements.map((r) => r.type)).toEqual([...CRITERION_TYPES]);
    for (const row of vm.requirements) {
      expect(row.acceptedStrengths.length).toBeGreaterThan(0);
      expect(row.constraintsLabel.length).toBeGreaterThan(0);
    }
  });

  it('rend une politique sans critère et une commande de CI non vide', () => {
    expect(vm.missingCriteriaLabel.length).toBeGreaterThan(0);
    expect(vm.ciCommand.length).toBeGreaterThan(0);
    expect(vm.ciCommand).toBe(generateCiCommand(DEMO_PROJECT_ID));
  });
});

/** La page projet sur les données de démo assemblées par les vrais domaines. */
function projectVm() {
  const data = createProjectDemoData();
  const vm = buildProjectPageViewModel({
    projectId: DEMO_PROJECT_ID,
    coverages: data.coverages,
    waivers: data.waivers,
    living: data.living,
    stats: data.stats,
    language: 'fr',
  });
  return { data, vm };
}

describe('page projet — view-model réel sur les données de démo', () => {
  it('rend au moins un ticket avec sa couverture « 2 / 4 »', () => {
    const { vm } = projectVm();
    expect(vm.issues.length).toBeGreaterThanOrEqual(1);
    expect(vm.issues[0]?.issueKey).toBe(DEMO_ISSUE_KEY);
    expect(vm.issues[0]?.coverage.label).toBe('2 / 4');
    expect(vm.issues[0]?.coverage.tone).toBe('orange');
  });

  it('compte les dérogations actives sans les révoquées', () => {
    const { vm } = projectVm();
    expect(vm.waivers).toHaveLength(2);
    expect(vm.activeWaiversCount).toBe(1);
    expect(vm.waivers.filter((w) => w.isRevoked)).toHaveLength(1);
  });

  it('rend au moins une preuve vivante qui n’est plus prouvée (FP-19)', () => {
    const { vm } = projectVm();
    expect(vm.unprovenLivingCount).toBeGreaterThanOrEqual(1);
    expect(vm.unprovenLiving.every((l) => l.state !== 'proven')).toBe(true);
    expect(vm.unprovenLiving[0]?.issueKey).toBe(DEMO_ISSUE_KEY);
  });

  it('rend des statistiques non vides et cohérentes avec le sample (FP-18)', () => {
    const { data, vm } = projectVm();
    expect(vm.stats).not.toBeNull();
    const machine = vm.stats?.proofsByStrength.find((s) => s.strength === 'machine-verified');
    expect(machine?.count).toBe(2); // les deux tests verts du sample PAY-123
    expect(vm.stats?.proofsByStrength).toHaveLength(3);
    expect(vm.stats?.waiversByGranter).toHaveLength(1);
    expect(vm.stats?.waiversByGranter[0]?.displayName).toBe('Sam PO');
    expect(vm.stats?.waiversByGranter[0]?.count).toBe(1);
    expect(vm.stats?.closedWithoutValidator).toBe(1);
    expect(data.stats.reopenings).toHaveLength(3);
    const declared = data.stats.reopenings.find((r) => r.strength === 'declared');
    expect(declared ? reopeningShare(declared) : 0).toBe(67);
  });
});

/** Toutes les clés feuilles d'un objet, en chemin pointé. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeys(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe('screens-extra — mêmes clés en FR et en EN', () => {
  it('a le même jeu de clés structurellement et aucun texte vide', () => {
    expect(leafKeys(SCREENS_EXTRA.fr).sort()).toEqual(leafKeys(SCREENS_EXTRA.en).sort());
    for (const key of leafKeys(SCREENS_EXTRA.fr)) {
      expect(SCREENS_EXTRA.fr[key as keyof typeof SCREENS_EXTRA.fr].length).toBeGreaterThan(0);
      expect(SCREENS_EXTRA.en[key as keyof typeof SCREENS_EXTRA.en].length).toBeGreaterThan(0);
    }
  });
});
