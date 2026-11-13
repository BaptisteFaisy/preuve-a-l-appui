/**
 * La notification hors Jira d'une preuve vivante dégradée (SPEC §13, §17).
 *
 * L'alerte part **à côté** de Jira, pas à sa place : le commentaire et la
 * notification Jira restent, le webhook s'y ajoute. Et sans canal configuré,
 * rien ne part — sans erreur.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { refreshLivingProofs } from '../../src/ingest/consume.js';
import type { AppDeps } from '../../src/deps.js';
import type { CiIngestMessage, WebhookMessage, WebhookNotifier } from '../../src/ports.js';
import {
  ISSUE_KEY,
  PROJECT_ID,
  TEST_REFUSAL,
  aCiSummary,
  aTestLink,
  aTestOutcome,
} from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';
import { NOW_ISO, depsFromScenario } from '../ingest/ci-deps.js';

/** Les dépendances avec un canal : le graphe réel porte `deps.webhook`. */
function depsWith(scenario: Pay123Scenario, channel?: WebhookNotifier): AppDeps {
  const deps = depsFromScenario(scenario);
  return channel === undefined ? deps : { ...deps, webhook: channel };
}

/** Un notificateur espion : il retient les messages au lieu de les envoyer. */
function spyNotifier(result = true): WebhookNotifier & { sent: WebhookMessage[] } {
  const sent: WebhookMessage[] = [];
  return {
    sent,
    enabled: true,
    async send(message: WebhookMessage): Promise<boolean> {
      sent.push(message);
      return result;
    },
  };
}

/** Un run sur `main` où le test suivi a échoué : la preuve vivante se dégrade. */
function failingMainRun(runId: string): CiIngestMessage {
  return {
    runId,
    projectId: PROJECT_ID,
    summary: aCiSummary({
      branch: 'main',
      mainBranch: true,
      commit: 'commit-regressed',
      tests: [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })],
    }),
  };
}

/** Ticket clos, paire test ↔ critère confirmée : le cas d'une preuve vivante. */
async function closedTicketWithLink(scenario: Pay123Scenario): Promise<void> {
  scenario.jira.issues.length = 0;
  scenario.jira.addIssue({ ...scenario.issue, status: 'Done', assigneeAccountId: 'dev-1' });
  await scenario.store.saveLink(
    aTestLink({ criterionId: 'crit-1', testName: TEST_REFUSAL, status: 'confirmed' }),
  );
}

describe('preuve vivante dégradée — notification hors Jira', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario(NOW_ISO);
    await closedTicketWithLink(scenario);
  });

  it('envoie un message lisible : ticket, critère, test, commit, destinataire', async () => {
    const notifier = spyNotifier();
    const deps = depsWith(scenario, notifier);

    await refreshLivingProofs(deps, PROJECT_ID, failingMainRun('run-webhook-1'));

    expect(notifier.sent).toHaveLength(1);
    const message = notifier.sent[0]!;
    expect(message.issueKey).toBe(ISSUE_KEY);
    expect(message.text).toContain(ISSUE_KEY);
    expect(message.text).toContain(TEST_REFUSAL);
    expect(message.text).toContain('commit-regressed');
    // « Qui » : le nom affiché du destinataire, jamais son identifiant.
    expect(message.text).toContain('To handle: ');
    expect(message.text).not.toContain('dev-1');
  });

  it('la notification Jira reste émise : le webhook s’ajoute, il ne remplace rien', async () => {
    const notifier = spyNotifier();
    const deps = depsWith(scenario, notifier);

    await refreshLivingProofs(deps, PROJECT_ID, failingMainRun('run-webhook-2'));

    expect(notifier.sent).toHaveLength(1);
    expect(scenario.jira.notifications.length).toBeGreaterThan(0);
    expect(scenario.jira.notifications[0]?.issueKey).toBe(ISSUE_KEY);
  });

  it('un envoi raté ne fait pas échouer le traitement du résumé', async () => {
    const notifier = spyNotifier(false);
    const deps = depsWith(scenario, notifier);

    await expect(
      refreshLivingProofs(deps, PROJECT_ID, failingMainRun('run-webhook-3')),
    ).resolves.toEqual({ updated: 1, alerts: 1 });
    expect(scenario.logger.atLevel('warn')).toContain('ci.living.webhook');
  });

  it('un notificateur qui lève est absorbé : rien ne remonte', async () => {
    const exploding: WebhookNotifier = {
      enabled: true,
      async send(): Promise<boolean> {
        throw new Error('canal cassé');
      },
    };
    const deps = depsWith(scenario, exploding);

    await expect(
      refreshLivingProofs(deps, PROJECT_ID, failingMainRun('run-webhook-4')),
    ).resolves.toEqual({ updated: 1, alerts: 1 });
    expect(scenario.logger.atLevel('warn')).toContain('ci.living.webhook_failed');
  });

  it('sans canal dans le graphe, aucun envoi et aucune erreur', async () => {
    const deps = depsFromScenario(scenario);

    await expect(
      refreshLivingProofs(deps, PROJECT_ID, failingMainRun('run-webhook-5')),
    ).resolves.toEqual({ updated: 1, alerts: 1 });
    // La notification Jira, elle, est bien partie.
    expect(scenario.jira.notifications.length).toBeGreaterThan(0);
  });
});
