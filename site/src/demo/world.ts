/**
 * Le monde de la démo : les VRAIS modules de l'app, assemblés en mémoire.
 *
 * Rien n'est simulé côté règles : le moteur de couverture, le validateur, les
 * gestes du panneau, les outils MCP et le consommateur de CI sont ceux du dépôt
 * (`src/domain`, `src/handlers`, `src/viewmodel`). Seuls les bords sont des
 * doubles en mémoire — exactement ceux de la suite de tests (`tests/helpers`),
 * ce qui garantit que la démo se comporte comme l'app.
 *
 * Deux mondes partagent ce câblage : le jeu PAY-123 embarqué (repli hors ligne)
 * et l'état RÉEL de l'app installée sur le site de démonstration Jira, lu par le
 * web trigger `demo-data` (`site/src/demo/live-world.ts`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Actor,
  CiSummary,
  Coverage,
  Criterion,
  Evidence,
  GateVerdict,
  IssueRef,
  ProjectSettings,
} from '../../../src/types.js';
import type { AppDeps } from '../../../src/deps.js';
import type { ActorContext, CoverageEngine } from '../../../src/ports.js';
import { createCoverageEngine } from '../../../src/domain/coverage-engine.js';
import { createValidator, type Validator, type ValidatorInput } from '../../../src/handlers/validator.js';
import { onCiMessage } from '../../../src/handlers/consumer.js';
import { runAction } from '../../../src/handlers/dispatch.js';
import { registerResolvers, type ResolverLike, type ResolverRequest } from '../../../src/handlers/resolver.js';
import { createPay123Scenario, type Pay123Scenario } from '../../../tests/helpers/scenario.js';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID } from '../../../tests/helpers/builders.js';
import type { FakeQueue } from '../../../tests/helpers/fake-gateways.js';
import type { FakeStore } from '../../../tests/helpers/fake-store.js';
import type { FakeJira } from '../../../tests/helpers/fake-gateways.js';
import type { FakeEvidenceChecker } from '../../../tests/helpers/fake-gateways.js';
import type { FakeLlm } from '../../../tests/helpers/fake-gateways.js';
import type { FakeIdentity } from '../../../tests/helpers/fake-gateways.js';
import type { FakeClock, FakeIds, RecordingLogger } from '../../../tests/helpers/fake-clock.js';
import type { CiIngestMessage } from '../../../src/ports.js';

/** D'où viennent les données affichées : le site le dit à l'écran. */
export interface DemoSource {
  /** `live` : lues dans l'app installée. `embedded` : jeu embarqué. */
  readonly kind: 'live' | 'embedded';
  /** Site Jira d'origine (lecture seule). */
  readonly site: string;
  /** Horodatage des données côté serveur. */
  readonly generatedAt: string;
  /** Horodatage de la lecture, côté navigateur. */
  readonly readAt: string;
  /** Raison du repli sur le jeu embarqué, vide quand tout va bien. */
  readonly error: string;
}

/** La distribution : quatre acteurs, comme dans l'app. */
export interface DemoActors {
  readonly agent: Actor;
  readonly developer: Actor;
  readonly tester: Actor;
  readonly owner: Actor;
}

/** Ce que les gestes de la démo manipulent : données, acteurs, provenance. */
export interface DemoScenario {
  readonly store: FakeStore;
  readonly jira: FakeJira;
  readonly checker: FakeEvidenceChecker;
  readonly llm: FakeLlm;
  readonly identity: FakeIdentity;
  readonly queue: FakeQueue;
  readonly clock: FakeClock;
  readonly ids: FakeIds;
  readonly logger: RecordingLogger;
  readonly project: ProjectSettings;
  readonly issue: IssueRef;
  readonly actors: DemoActors;
  readonly ciSummary: CiSummary;
  readonly criteria: readonly Criterion[];
  readonly evidences: readonly Evidence[];
  readonly source: DemoSource;
}

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

/** Tout ce que la démo manipule : monde + modules réels. */
export interface DemoWorld {
  readonly scenario: DemoScenario;
  readonly deps: AppDeps;
  readonly resolver: MemoryResolver;
  readonly validator: Validator;
  readonly queue: FakeQueue;
  /** Provenance des données : lues en direct ou jeu embarqué. */
  readonly source: DemoSource;
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

/** Câble les modules réels sur un scénario (embarqué ou réel). */
export async function createWorld(scenario: DemoScenario): Promise<DemoWorld> {
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
    source: scenario.source,
    coverage: () => coverage.read(scenario.issue.id),
    recompute: () => coverage.recompute(scenario.issue.id),
    transition: (mode?: string) => validator(transitionInput(scenario.issue.key, mode)),
    ci: (message) => onCiMessage(message, deps),
    tool: (name, payload, context) => runAction(name, payload, deps, context),
    agentContext,
    panelContext,
  };
}

/** Charge utile du validateur : la transition vers « Terminé » (SPEC §19). */
export function transitionInput(issueKey: string, mode?: string): ValidatorInput {
  const configuration = mode ? { mode } : {};
  return {
    issueKey,
    configuration,
    transition: { fromStatus: 'In Progress', toStatus: 'Done' },
  };
}

/** Le jeu embarqué : PAY-123, tel que décrit au cahier des charges §7. */
export async function createDemoWorld(): Promise<DemoWorld> {
  const scenario: Pay123Scenario = await createPay123Scenario();
  const now = new Date().toISOString();
  return createWorld({
    store: scenario.store,
    jira: scenario.jira,
    checker: scenario.checker,
    llm: scenario.llm,
    identity: scenario.identity,
    queue: scenario.queue,
    clock: scenario.clock,
    ids: scenario.ids,
    logger: scenario.logger,
    project: scenario.project,
    issue: scenario.issue,
    actors: scenario.actors,
    ciSummary: scenario.ciSummary,
    criteria: scenario.criteria,
    evidences: scenario.evidences,
    source: { kind: 'embedded', site: '', generatedAt: now, readAt: now, error: '' },
  });
}

export { ISSUE_ID, ISSUE_KEY, PROJECT_ID };
