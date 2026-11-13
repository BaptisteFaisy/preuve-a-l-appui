/**
 * Le simulateur du site public, testé comme le reste : sur le VRAI domaine,
 * avec les fakes en mémoire de la suite de tests et l'instantané réel embarqué
 * (`site/public/live-snapshot.json`).
 *
 * Ce que ces tests prouvent :
 * 1. choisir un critère et un type de preuve change la force affichée, et le
 *    changement vient du domaine (couverture recalculée, pas d'un `if` ici) ;
 * 2. un geste que l'app refuse est refusé ET expliqué, avec la raison du
 *    domaine (indépendance de l'attestation) ;
 * 3. « recommencer » rebâtit le monde : l'état repart de l'instantané ;
 * 4. le HTML rendu ne porte aucun identifiant de compte — seulement des noms.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Language } from '../../src/types.js';
import type { DemoWorld } from '../../site/src/demo/world.js';
import {
  DEFAULT_CHOICE,
  attachProof,
  buildWorld,
  firstCriterionCode,
  renderWorld,
  type SimulatorChoice,
  type SimulatorRuntime,
} from '../../site/src/sections/parts/simulator/engine.js';
import type { SimulatorCriterion, SimulatorView } from '../../site/src/sections/parts/simulator/viewmodel.js';
import { SimulatorBody } from '../../site/src/sections/parts/simulator/SimulatorBody.js';
import { Simulator } from '../../site/src/sections/Simulator.js';
import { Nav } from '../../site/src/sections/Nav.js';

/** Un monde neuf, en français, sur l'instantané réel : chaque test repart de là. */
async function freshWorld(language: Language = 'fr'): Promise<DemoWorld> {
  return buildWorld(language);
}

/** Le choix du visiteur, prêt à jouer. */
function choiceOf(patch: Partial<SimulatorChoice> = {}): SimulatorChoice {
  return { ...DEFAULT_CHOICE, criterionCode: 'AC-3', type: 'attestation', role: 'tester', reference: '', ...patch };
}

/** Une exécution complète : le monde, le choix, le geste, l'état qui suit. */
async function run(
  world: DemoWorld,
  choice: SimulatorChoice,
  language: Language = 'fr',
): Promise<SimulatorRuntime> {
  const outcome = await attachProof(world, choice);
  return renderWorld(world, choice, language, outcome);
}

/** Le critère d'une vue, par son code stable (`AC-1`, SPEC §8.1). */
function criterionOf(view: SimulatorView, code: string): SimulatorCriterion {
  const found = view.criteria.find((criterion) => criterion.code === code);
  if (!found) throw new Error(`critère absent de la vue : ${code}`);
  return found;
}

/** Le HTML rendu du simulateur, avec un état déjà bâti. */
function htmlOf(runtime: SimulatorRuntime, choice: SimulatorChoice, lang: Language = 'fr'): string {
  return renderToStaticMarkup(
    createElement(SimulatorBody, {
      lang,
      runtime,
      choice,
      busy: false,
      onChoose: () => undefined,
      onAttach: () => undefined,
      onReset: () => undefined,
    }),
  );
}

describe('simulateur — le ticket réel et son état de départ', () => {
  it('part du ticket de l’instantané : 2 / 4 et le validateur bloque', async () => {
    const world = await freshWorld();
    const runtime = await renderWorld(world, choiceOf(), 'fr', null);
    expect(runtime.view.issueKey).toBe('PRF-1');
    expect(runtime.view.coverageLabel).toBe('2 / 4');
    expect(runtime.view.criteria).toHaveLength(4);
    expect(criterionOf(runtime.view, 'AC-3').proven).toBe(false);
    expect(criterionOf(runtime.view, 'AC-3').bestStrength).toBe('declared');
    expect(runtime.verdict?.result).toBe(false);
    expect(runtime.verdict?.errorMessage).toContain('AC-4');
  });

  it('propose les six types de preuve et les quatre personnes, sans identifiant', async () => {
    const world = await freshWorld();
    const runtime = await renderWorld(world, choiceOf(), 'fr', null);
    expect(runtime.view.types.map((option) => option.type)).toEqual([
      'test',
      'documentation',
      'attestation',
      'attachment',
      'agent-report',
      'link',
    ]);
    expect(runtime.view.actors.map((actor) => actor.role)).toEqual([
      'agent',
      'developer',
      'tester',
      'owner',
    ]);
    expect(runtime.view.actors.every((actor) => actor.name.length > 0)).toBe(true);
    expect(await firstCriterionCode(world)).toBe('AC-1');
  });
});

describe('simulateur — le verdict change, par le vrai domaine', () => {
  it('une attestation indépendante prouve AC-3 et fait monter la couverture', async () => {
    const world = await freshWorld();
    const choice = choiceOf({ criterionCode: 'AC-3', type: 'attestation', role: 'tester' });
    const runtime = await run(world, choice);

    expect(runtime.outcome?.outcome).toBe('ok');
    expect(criterionOf(runtime.view, 'AC-3').proven).toBe(true);
    expect(criterionOf(runtime.view, 'AC-3').bestStrength).toBe('attested');
    expect(runtime.view.coverageLabel).toBe('3 / 4');
    // AC-4 reste sans preuve : le validateur bloque toujours, et le dit.
    expect(runtime.verdict?.result).toBe(false);
    expect(runtime.verdict?.errorMessage).toContain('AC-4');
  });

  it('la force affichée change au rendu : « déclaré » devient « attesté »', async () => {
    const world = await freshWorld();
    const choice = choiceOf({ criterionCode: 'AC-3', type: 'attestation', role: 'tester' });
    const before = await renderWorld(world, choice, 'fr', null);
    const beforeHtml = htmlOf(before, choice);
    expect(beforeHtml).toContain('Retenue par l’app</dt><dd>Déclaré</dd>');

    const after = await run(world, choice);
    const afterHtml = htmlOf(after, choice);
    expect(afterHtml).toContain('Retenue par l’app</dt><dd>Attesté</dd>');
    expect(afterHtml).toContain('<strong>3 / 4</strong>');
  });

  it('une attestation ne vaut pas une preuve machine : AC-4 reste bloqué', async () => {
    const world = await freshWorld();
    const runtime = await run(world, choiceOf({ criterionCode: 'AC-4', role: 'tester' }));
    const criterion = criterionOf(runtime.view, 'AC-4');
    expect(runtime.outcome?.outcome).toBe('ok');
    expect(criterion.bestStrength).toBe('attested');
    expect(criterion.requiredStrengthLabel).toContain('machine');
    expect(criterion.proven).toBe(false);
    expect(criterion.defectLabel).toContain('Force de preuve insuffisante');
  });

  it('l’agent ne déclare qu’en « declared », même pour un test', async () => {
    const world = await freshWorld();
    const runtime = await run(
      world,
      choiceOf({ criterionCode: 'AC-4', type: 'test', role: 'agent', reference: 'checkout test' }),
    );
    expect(runtime.outcome?.outcome).toBe('ok');
    expect(criterionOf(runtime.view, 'AC-4').bestStrength).toBe('declared');
    expect(criterionOf(runtime.view, 'AC-4').proven).toBe(false);
    expect(runtime.view.coverageLabel).toBe('2 / 4');
  });
});

describe('simulateur — ce que l’app refuse est refusé et expliqué', () => {
  it('l’assignée n’atteste pas son propre critère', async () => {
    const world = await freshWorld();
    const runtime = await run(world, choiceOf({ criterionCode: 'AC-3', role: 'developer' }));
    expect(runtime.outcome?.outcome).toBe('refused');
    expect(runtime.outcome?.detail).toContain('assigné');
    // Rien n’a bougé : le refus vient du domaine, avant toute écriture.
    expect(criterionOf(runtime.view, 'AC-3').proven).toBe(false);
    expect(runtime.view.coverageLabel).toBe('2 / 4');
  });

  it('le refus est affiché avec la raison de l’app, pas une phrase du site', async () => {
    const world = await freshWorld();
    const choice = choiceOf({ criterionCode: 'AC-3', role: 'developer' });
    const runtime = await run(world, choice);
    const html = htmlOf(runtime, choice);
    expect(html).toContain('L’app a refusé');
    expect(html).toContain('assigné');
  });

  it('l’agent ne peut pas attester, même via l’outil MCP', async () => {
    const world = await freshWorld();
    const runtime = await run(world, choiceOf({ criterionCode: 'AC-3', role: 'agent' }));
    expect(runtime.outcome?.outcome).toBe('refused');
    expect((runtime.outcome?.detail ?? '').length).toBeGreaterThan(0);
    expect(criterionOf(runtime.view, 'AC-3').proven).toBe(false);
  });
});

describe('simulateur — revenir en arrière', () => {
  it('recommencer rebâtit le monde : la couverture repart de 2 / 4', async () => {
    const world = await freshWorld();
    const choice = choiceOf({ criterionCode: 'AC-3', role: 'tester' });
    const played = await run(world, choice);
    expect(played.view.coverageLabel).toBe('3 / 4');

    // « Recommencer » construit un monde neuf, comme le bouton de la page.
    const restarted = await freshWorld();
    const runtime = await renderWorld(restarted, choice, 'fr', null);
    expect(runtime.view.coverageLabel).toBe('2 / 4');
    expect(criterionOf(runtime.view, 'AC-3').bestStrength).toBe('declared');
    expect(criterionOf(runtime.view, 'AC-3').proven).toBe(false);
    expect(runtime.outcome).toBeNull();
  });
});

describe('simulateur — rendu accessible et sans identifiant de compte', () => {
  it('n’affiche aucun identifiant de compte, seulement des noms', async () => {
    const world = await freshWorld();
    const choice = choiceOf();
    const runtime = await renderWorld(world, choice, 'fr', null);
    const html = htmlOf(runtime, choice);
    for (const identifier of ['actor-1', 'actor-2', 'actor-3', 'actor-4', '712020:', 'qm:']) {
      expect(html).not.toContain(identifier);
    }
    expect(html).toContain('Alison Swift');
  });

  it('rend la section, ses étiquettes et son ancre de navigation', async () => {
    const section = renderToStaticMarkup(createElement(Simulator, { lang: 'fr' }));
    expect(section).toContain('id="simulator"');
    expect(section).toContain('Simulateur');

    const world = await freshWorld();
    const choice = choiceOf();
    const html = htmlOf(await renderWorld(world, choice, 'fr', null), choice);
    expect(html).toContain('for="simulator-criterion"');
    expect(html).toContain('id="simulator-actor"');
    expect(html).toContain('aria-describedby="simulator-reference-hint"');
    expect(html).toContain('Attacher la preuve');
    expect(html).toContain('aria-live="polite"');

    const nav = renderToStaticMarkup(
      createElement(Nav, { lang: 'fr', onToggleLang: () => undefined }),
    );
    expect(nav).toContain('href="#simulator"');
  });

  it('parle anglais quand le site est en anglais', async () => {
    const world = await freshWorld('en');
    const choice = choiceOf({ criterionCode: 'AC-3', role: 'developer' });
    const runtime = await run(world, choice, 'en');
    expect(runtime.outcome?.detail).toContain('Assignee');
    const html = htmlOf(runtime, choice, 'en');
    expect(html).toContain('The app refused');
    expect(html).toContain('Required');
  });
});
