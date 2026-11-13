/**
 * Fixture de test dédiée aux actions MCP et au handler dispatch (SPEC §15).
 *
 * Rejoue le scénario PAY-123 (§7) avec le graphe de dépendances complet :
 * les fakes partagés de `tests/helpers/` sont câblés sur `AppDeps`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../../src/deps.js';
import type { ActorContext } from '../../src/ports.js';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';

export interface McpTestHarness {
  scenario: Pay123Scenario;
  deps: AppDeps;
  mcpContext: ActorContext;
  humanContext: ActorContext;
}

export async function createMcpHarness(): Promise<McpTestHarness> {
  const scenario = await createPay123Scenario();
  const deps: AppDeps = {
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

  const mcpContext: ActorContext = {
    accountId: scenario.actors.agent.accountId,
    moduleId: 'mcp-proof',
    fromMcp: true,
    cloudId: 'cloud-test',
  };

  const humanContext: ActorContext = {
    accountId: scenario.actors.developer.accountId,
    moduleId: 'jira:issuePanel',
    fromMcp: false,
    cloudId: 'cloud-test',
  };

  return { scenario, deps, mcpContext, humanContext };
}

export { ISSUE_ID, ISSUE_KEY, PROJECT_ID };
