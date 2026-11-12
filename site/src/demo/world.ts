/**
 * Le monde de la démo : les VRAIS modules de l'app, assemblés en mémoire.
 *
 * Rien n'est simulé côté règles : le moteur de couverture, le validateur, les
 * gestes du panneau, les outils MCP et le consommateur de CI sont ceux du
 * dépôt (`src/domain`, `src/handlers`, `src/viewmodel`). Seuls les bords sont
 * des doubles en mémoire — exactement ceux de la suite de tests
 * (`tests/helpers`), ce qui garantit que la démo se comporte comme l'app.
 *
 * Le web trigger n'est pas appelé : il signe les requêtes avec `node:crypto`,
 * absent du navigateur. La démo remet donc le résumé directement au
 * consommateur (`onCiMessage`), qui est l'étape suivante dans l'app (SPEC §17).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../../../src/deps.js';
import type { ActorContext, CoverageEngine } from '../../../src/ports.js';
import type { Coverage, GateVerdict } from '../../../src/types.js';
import { createCoverageEngine } from '../../../src/domain/coverage-engine.js';
import { createValidator, type Validator, type ValidatorInput } from '../../../src/handlers/validator.js';
import { onCiMessage } from '../../../src/handlers/consumer.js';
import { runAction } from '../../../src/handlers/dispatch.js';
import {
  registerResolvers,
  type ResolverLike,
  type ResolverRequest,
} from '../../../src/handlers/resolver.js';
import { createPay123Scenario, type Pay123Scenario } from '../../../tests/helpers/scenario.js';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID } from '../../../tests/helpers/builders.js';
import type { FakeQueue } from '../../../tests/helpers/fake-gateways.js';
import type { CiIngestMessage } from '../../../src/ports.js';

/** Résolveur en mémoire : mêmes clés que le module Forge, mêmes handlers. */
export class MemoryResolver implements ResolverLike {
  private readonly definitions = new Map<string, (request: ResolverRequest) => Promise<unknown>>();

  define(key: string, fn: (request: ResolverRequest) => Promise<unknown>): void {
    this.definitions.set(key, fn);
  }

  async call(
    key: string,
    payload: Record<string, unknown> = {},
    context: unknown = {},
  ): Promise<unknown> {
    const fn = this.definitions.get(key);
    if (!fn) throw new Error(`clé de résolveur inconnue : ${key}`);
    return fn({ payload, context });
  }
}

/** Tout ce que la démo manipule : monde PAY-123 + modules réels câblés. */
export interface DemoWorld {
  readonly scenario: Pay123Scenario;
  readonly deps: AppDeps;
  readonly resolver: MemoryResolver;
  readonly validator: Validator;
  readonly queue: FakeQueue;
  coverage(): Promise<Coverage | null>;
  recompute(): Promise<Coverage | null>;
  transition(mode?: string): Promise<GateVerdict>;
  ci(message: CiIngestMessage): Promise<void>;
  tool(name: string, payload: Record<string, unknown>, context: ActorContext): Promise<unknown>;
  agentContext(accountId: string): ActorContext;
  panelContext(accountId: string): ActorContext;
}

/** Contexte Forge d'un appel venu du panneau (humain). */
function panelContext(accountId: string): ActorContext {
  return { accountId, moduleId: 'jira:issuePanel', fromMcp: false, cloudId: 'cloud-demo' };
}

/** Contexte Forge d'un appel venu de MCP : toujours marqué agent (SPEC §19). */
function agentContext(accountId: string): ActorContext {
  return { accountId, moduleId: 'rovo:mcp', fromMcp: true, cloudId: 'cloud-demo' };
}

/** Construit le monde : scénario PAY-123 + moteur de couverture réel. */
export async function createDemoWorld(): Promise<DemoWorld> {
  const scenario = await createPay123Scenario();
  const { store, jira, checker, llm, identity, queue, clock, ids, logger } = scenario;
  const coverage: CoverageEngine = createCoverageEngine({ store, clock, logger, jira });
  const deps: AppDeps = { store, coverage, jira, checker, llm, identity, queue, clock, ids, logger };
  const resolver = new MemoryResolver();
  registerResolvers(resolver, deps);
  const validator = createValidator(deps);

  return {
    scenario,
    deps,
    resolver,
    validator,
    queue,
    coverage: () => coverage.read(ISSUE_ID),
    recompute: () => coverage.recompute(ISSUE_ID),
    transition: (mode?: string) => validator(transitionInput(mode)),
    ci: (message) => onCiMessage(message, deps),
    tool: (name, payload, context) => runAction(name, payload, deps, context),
    agentContext,
    panelContext,
  };
}

/** Charge utile du validateur : la transition vers « Terminé » (SPEC §19). */
export function transitionInput(mode?: string): ValidatorInput {
  const configuration = mode ? { mode } : {};
  return {
    issueKey: ISSUE_KEY,
    configuration,
    transition: { fromStatus: 'In Progress', toStatus: 'Done' },
  };
}

export { ISSUE_ID, ISSUE_KEY, PROJECT_ID };
