/**
 * Demande d'attestation à un tiers (SPEC §9.4, §14 FP-15, FP-08).
 *
 * Ce que ces tests garantissent :
 * - la demande n'est jamais adressée à l'assigné du ticket ;
 * - elle vise le rôle compétent exigé par la grille du projet ;
 * - elle **n'atteste rien** : aucune attestation n'est écrite, aucune force de
 *   preuve ne change, la couverture n'est pas recalculée ;
 * - un agent peut demander (SPEC §7.1, étape 4) ;
 * - les messages passent par l'i18n, en anglais et en français (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDeps } from '../../src/deps.js';
import { requestAttestation, type AttestationRequest } from '../../src/handlers/attestation-request.js';
import { aCriterion, ISSUE_ID, PROJECT_ID, settings as buildSettings, TESTER, OWNER, DEVELOPER } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';

function depsOf(scenario: Pay123Scenario): AppDeps {
  return {
    store: scenario.store,
    coverage: scenario.coverage,
    jira: scenario.jira,
    checker: scenario.checker,
    llm: scenario.llm,
    identity: scenario.identity,
    queue: scenario.queue,
    clock: scenario.clock,
    ids: scenario.ids,
    logger: scenario.logger,
  };
}

function aRequest(partial: Partial<AttestationRequest> = {}): AttestationRequest {
  return {
    issueKey: 'PAY-123',
    criterionCode: 'AC-3',
    targetAccountId: TESTER,
    what: 'déclencher un refus de paiement et vérifier l’e-mail',
    requester: { accountId: DEVELOPER, displayName: 'Camille Dev', agent: false, roles: ['Developers'] },
    ...partial,
  };
}

describe('handlers/attestation-request — indépendance de l’attestant', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario();
  });

  it('refuse une demande adressée à l’assigné du ticket', async () => {
    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ targetAccountId: DEVELOPER }),
    );

    expect(result.ok).toBe(false);
    expect(result.notified).toBe(false);
    expect(result.errorMessage).toMatch(/assignee/i);
    expect(scenario.jira.notifications).toHaveLength(0);
  });

  it('refuse une cible sans le rôle compétent du projet', async () => {
    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ targetAccountId: OWNER }),
    );

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/competent role/i);
    expect(scenario.jira.notifications).toHaveLength(0);
  });

  it('exige le rôle désigné pour un critère de sécurité (SPEC §9.2)', async () => {
    await scenario.store.saveCriterion(
      aCriterion({ id: 'crit-sec', issueId: ISSUE_ID, code: 'AC-9', type: 'security' }),
    );

    const refused = await requestAttestation(
      depsOf(scenario),
      aRequest({ criterionCode: 'AC-9' }),
    );
    expect(refused.ok).toBe(false);
    expect(refused.errorMessage).toMatch(/competent role/i);

    scenario.jira.setRoles(TESTER, ['Security Reviewer']);
    const accepted = await requestAttestation(
      depsOf(scenario),
      aRequest({ criterionCode: 'AC-9' }),
    );
    expect(accepted.ok).toBe(true);
  });
});

describe('handlers/attestation-request — notification sans attestation', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario();
  });

  it('notifie la testeuse compétente et n’atteste rien', async () => {
    const result = await requestAttestation(depsOf(scenario), aRequest());

    expect(result.ok).toBe(true);
    expect(result.notified).toBe(true);
    expect(result.criterion?.code).toBe('AC-3');
    expect(scenario.jira.notifications).toHaveLength(1);
    expect(scenario.jira.notifications[0]?.accountId).toBe(TESTER);
    // La demande n'atteste rien : aucune ligne `attestation` n'est écrite.
    expect(scenario.store.__tables.attestations.size).toBe(0);
    // Et elle ne recalcule pas la couverture (point de passage unique, §12.3).
    expect(scenario.coverage.journal.count('recompute')).toBe(0);
  });

  it('nomme le critère et le ticket dans la notification', async () => {
    await requestAttestation(depsOf(scenario), aRequest());

    const notification = scenario.jira.notifications[0];
    expect(notification?.issueKey).toBe('PAY-123');
    expect(notification?.subjectKey).toContain('PAY-123');
    expect(notification?.bodyKey).toContain('AC-3');
    expect(notification?.bodyKey).toContain('déclencher un refus de paiement');
  });

  it('accepte une demande formulée par un agent (SPEC §7.1)', async () => {
    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ requester: scenario.actors.agent }),
    );

    expect(result.ok).toBe(true);
    expect(result.notified).toBe(true);
  });
});

describe('handlers/attestation-request — erreurs nommées et langues', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario();
  });

  it('rend une erreur nommée pour un ticket inconnu', async () => {
    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ issueKey: 'PAY-404' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('PAY-404');
  });

  it('rend une erreur nommée pour un critère inconnu', async () => {
    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ criterionCode: 'AC-42' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('AC-42');
    expect(scenario.jira.notifications).toHaveLength(0);
  });

  it('répond dans la langue du projet (français)', async () => {
    await scenario.store.saveSettings(
      buildSettings({ projectId: PROJECT_ID, language: 'fr', updatedAt: scenario.clock.now() }),
    );

    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ targetAccountId: DEVELOPER }),
    );

    expect(result.errorMessage).toContain('assigné');
  });

  it('répond en anglais par défaut', async () => {
    const result = await requestAttestation(
      depsOf(scenario),
      aRequest({ targetAccountId: DEVELOPER }),
      'en',
    );

    expect(result.errorMessage).toContain('assignee');
  });
});
