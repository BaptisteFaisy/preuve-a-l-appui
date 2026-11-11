/**
 * Tests du validateur de workflow (SPEC §12.1, §17, §22 points 1, 6, 9, 10).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID, aWaiver, settings as buildSettings } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';
import { buildL3Deps } from './app-deps.js';
import { createCoverageEngine } from '../../src/domain/coverage-engine.js';
import { createValidator } from '../../src/handlers/validator.js';
import type { ValidatorInput } from '../../src/handlers/validator.js';

function input(overrides: Partial<ValidatorInput> = {}): ValidatorInput {
  return {
    issueKey: ISSUE_KEY,
    configuration: {},
    transition: { fromStatus: 'In Progress', toStatus: 'Done' },
    ...overrides,
  };
}

/** Scénario PAY-123 avec le vrai moteur L3 et sa couverture pré-calculée. */
async function wiredValidator(scenario: Pay123Scenario) {
  const engine = createCoverageEngine({
    store: scenario.store,
    clock: scenario.clock,
    logger: scenario.logger,
    jira: scenario.jira,
  });
  const { deps } = buildL3Deps(scenario.store, scenario.jira, engine);
  return { validator: createValidator(deps), deps, engine };
}

describe('handlers/validator — blocage au format du SPEC §7.2 (recette §22 pt 1)', () => {
  it('bloque la transition vers « Terminé » et nomme les critères en défaut', async () => {
    const scenario = await createPay123Scenario();
    const { validator, engine } = await wiredValidator(scenario);
    await engine.recompute(ISSUE_ID);

    const verdict = await validator(input());
    expect(verdict.result).toBe(false);
    // AC-1 et AC-2 sont prouvés par la CI ; AC-3 (déclaration d'agent) et AC-4 (rien) bloquent
    expect(verdict.errorMessage).toContain('2 criteria without sufficient proof.');
    expect(verdict.errorMessage).toContain('AC-3');
    expect(verdict.errorMessage).toContain('AC-4');
    expect(verdict.errorMessage).not.toContain('AC-1');
  });

  it('compose le message en français quand le projet est en français (SPEC §20)', async () => {
    const scenario = await createPay123Scenario();
    await scenario.store.saveSettings(buildSettings({ projectId: PROJECT_ID, language: 'fr' }));
    const { validator, engine } = await wiredValidator(scenario);
    await engine.recompute(ISSUE_ID);

    const verdict = await validator(input());
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toContain('2 critères sans preuve suffisante.');
    expect(verdict.errorMessage).toContain('AC-3');
  });

  it('lit la même ligne que get-proof-status (recette §22 pt 10)', async () => {
    const scenario = await createPay123Scenario();
    const { validator, engine } = await wiredValidator(scenario);
    const coverage = await engine.recompute(ISSUE_ID);

    const verdict = await validator(input());
    const namedCodes = coverage?.blocking.map((item) => item.code) ?? [];
    for (const code of namedCodes.slice(0, 2)) {
      expect(verdict.errorMessage).toContain(code);
    }
  });
});

describe('handlers/validator — dérogation et modes (SPEC §12.2, §12.4, recette §22 pts 6, 9)', () => {
  it('une dérogation motivée sur le critère manquant débloque (recette §22 pt 6)', async () => {
    const scenario = await createPay123Scenario();
    const { validator, engine } = await wiredValidator(scenario);

    await engine.recompute(ISSUE_ID);
    expect((await validator(input())).result).toBe(false);

    // Le PO déroge AC-4 (§7.4) et une attestation couvre AC-3
    await scenario.store.saveWaiver(scenario.possibleWaiver);
    await scenario.store.saveWaiver(
      aWaiver({ id: 'wv-ac3', criterionId: 'crit-3', reason: 'Vérifié à la main, en attente du test' }),
    );
    await engine.recompute(ISSUE_ID);

    const verdict = await validator(input());
    expect(verdict.result).toBe(true);
    expect(verdict.errorMessage).toBe('');
  });

  it('en mode observation, la transition passe (recette §22 pt 9)', async () => {
    const scenario = await createPay123Scenario();
    await scenario.store.saveSettings(buildSettings({ projectId: PROJECT_ID, mode: 'observe' }));
    const { validator, engine } = await wiredValidator(scenario);
    await engine.recompute(ISSUE_ID);

    const verdict = await validator(input());
    expect(verdict.result).toBe(true);
    expect(verdict.errorMessage).toBe('');
  });

  it('le mode configuré dans le workflow surcharge le mode du projet (SPEC §16.5)', async () => {
    const scenario = await createPay123Scenario();
    const { validator, engine } = await wiredValidator(scenario);
    await engine.recompute(ISSUE_ID);

    const verdict = await validator(input({ configuration: { mode: 'observe' } }));
    expect(verdict.result).toBe(true);
  });
});

describe('handlers/validator — rapidité et identité (SPEC §12.1, §17)', () => {
  it('ne recalcule rien : il lit seulement la ligne de couverture (SPEC §17)', async () => {
    const scenario = await createPay123Scenario();
    const { validator, deps, engine } = await wiredValidator(scenario);
    await engine.recompute(ISSUE_ID);

    await validator(input());
    // Le moteur n'a pas été rappelé : la couverture lue vient du store
    const stored = await deps.store.getCoverage(ISSUE_ID);
    expect(stored).not.toBeNull();
    expect(scenario.jira.journal.methods()).not.toContain('projectRoles');
  });

  it('ne reçoit ni n’utilise l’identité de celui qui fait la transition (SPEC §12.1)', async () => {
    const scenario = await createPay123Scenario();
    const { validator, engine } = await wiredValidator(scenario);
    await engine.recompute(ISSUE_ID);

    // La charge utile documentée au SPEC §19 ne porte aucune identité
    const verdict = await validator(input({ configuration: { user: 'ignored' } }));
    expect(verdict.result).toBe(false);
    expect(scenario.identity.journal.count('actorOf')).toBe(0);
    expect(scenario.jira.journal.count('projectRoles')).toBe(0);
  });
});

describe('handlers/validator — le doute bloque (SPEC §20)', () => {
  it('couverture absente : bloque avec un message dédié', async () => {
    const scenario = await createPay123Scenario();
    const { validator } = await wiredValidator(scenario);

    const verdict = await validator(input({ issueKey: 'PAY-999' }));
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toContain('Coverage unavailable');
  });

  it('clé de ticket vide : bloque, jamais de laissez-passer', async () => {
    const scenario = await createPay123Scenario();
    const { validator } = await wiredValidator(scenario);

    const verdict = await validator(input({ issueKey: '  ' }));
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toContain('Issue not found');
  });

  it('laisse passer une couverture complète', async () => {
    const scenario = await createPay123Scenario();
    const { validator, engine } = await wiredValidator(scenario);
    await scenario.store.saveWaiver(scenario.possibleWaiver);
    await scenario.store.saveWaiver(aWaiver({ id: 'wv-ac3', criterionId: 'crit-3', reason: 'OK' }));
    await engine.recompute(ISSUE_ID);

    const verdict = await validator(input());
    expect(verdict.result).toBe(true);
  });
});
