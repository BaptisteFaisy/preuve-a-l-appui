/**
 * Harnais de la recette de bout en bout (SPEC §22, lot L10).
 *
 * Un seul endroit assemble les VRAIS modules des neuf lots sur les fakes en
 * mémoire de `tests/helpers/` (docs/CONTRACTS.md §5) :
 * - le vrai moteur de couverture `createCoverageEngine` (SPEC §12.3, §1bis) ;
 * - les vrais handlers : `createValidator`, `handleCiResults`, `onCiMessage`,
 *   `onJiraEvent`, `runAction`, `registerResolvers` ;
 * - le vrai domaine : `attachEvidence`, `changeCriterionText`, `canAttest`,
 *   `validateWaiverCandidate`, `buildVersionDossier`.
 *
 * Aucun réseau, horloge injectée (le scénario PAY-123 fige l'instant), aucun
 * ordre d'exécution requis : chaque test recrée son harnais. Le point de
 * passage obligé est respecté : validateur, consommateur et `get-proof-status`
 * lisent la même ligne de couverture (SPEC §22 point 10).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../../src/deps.js';
import type { ActorContext, CiIngestMessage, CoverageEngine } from '../../src/ports.js';
import type { CiSummary, Coverage, GateVerdict } from '../../src/types.js';
import { createCoverageEngine } from '../../src/domain/coverage-engine.js';
import { attachEvidence } from '../../src/domain/evidence.js';
import { changeCriterionText } from '../../src/domain/criteria-change.js';
import { canAttest } from '../../src/domain/independence.js';
import { findActiveWaiver, validateWaiverCandidate } from '../../src/domain/waivers.js';
import { buildVersionDossier, renderDossierMarkdown } from '../../src/domain/dossier.js';
import { createValidator, type Validator, type ValidatorInput } from '../../src/handlers/validator.js';
import { handleCiResults, type CiWebRequest, type CiWebResponse } from '../../src/handlers/ingest.js';
import { onCiMessage } from '../../src/handlers/consumer.js';
import { onJiraEvent } from '../../src/handlers/events.js';
import { runAction } from '../../src/handlers/dispatch.js';
import {
  registerResolvers,
  type ResolverLike,
  type ResolverRequest,
} from '../../src/handlers/resolver.js';
import { computeHmacSha256 } from '../../src/ingest/signature.js';
import { hashCiKey } from '../../src/ingest/webtrigger.js';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID, PROJECT_KEY } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';
import type { FakeQueue } from '../helpers/fake-gateways.js';

/** Clé de projet CI ; seule son empreinte SHA-256 est rangée en base (SPEC §10). */
export const CI_KEY = 'ci-key-pay-project';

/** Résolveur de test : enregistre les définitions, les rappelle à la demande. */
class TestResolver implements ResolverLike {
  private readonly defs = new Map<string, (request: ResolverRequest) => Promise<unknown>>();
  define(key: string, fn: (request: ResolverRequest) => Promise<unknown>): void {
    this.defs.set(key, fn);
  }
  keys(): string[] {
    return [...this.defs.keys()];
  }
  async call(
    key: string,
    payload: Record<string, unknown> = {},
    context: unknown = {},
  ): Promise<unknown> {
    const fn = this.defs.get(key);
    if (!fn) throw new Error(`clé de résolveur non définie : ${key}`);
    return fn({ payload, context });
  }
}

/** Requête de web trigger CI signée (SPEC §10) pour l'instant de l'horloge. */
export function signedCiRequest(body: string, nowIso: string): CiWebRequest {
  const timestamp = String(Math.floor(Date.parse(nowIso) / 1000));
  const signature = computeHmacSha256(CI_KEY, timestamp, body);
  return {
    method: 'POST',
    path: '/ci-results',
    headers: {
      'content-type': 'application/json',
      'x-ci-key': CI_KEY,
      'x-ci-timestamp': timestamp,
      'x-ci-signature': signature,
    },
    body,
    query: {},
  };
}

/** Tout ce qu'un test de recette manipule : modules réels + aides. */
export interface AcceptanceHarness {
  readonly scenario: Pay123Scenario;
  readonly deps: AppDeps;
  readonly coverage: CoverageEngine;
  readonly validator: Validator;
  readonly resolver: TestResolver;
  readonly queue: FakeQueue;
  readonly mcpContext: ActorContext;
  readonly humanContext: ActorContext;
  readonly testerContext: ActorContext;
  readonly ownerContext: ActorContext;
  /** Vrais modules du domaine, câblés (aucune réécriture). */
  readonly attachEvidence: typeof attachEvidence;
  readonly changeCriterionText: typeof changeCriterionText;
  readonly canAttest: typeof canAttest;
  readonly validateWaiverCandidate: typeof validateWaiverCandidate;
  readonly findActiveWaiver: typeof findActiveWaiver;
  readonly buildVersionDossier: typeof buildVersionDossier;
  readonly renderDossierMarkdown: typeof renderDossierMarkdown;
  /** Recalcule et stocke la couverture d'un ticket (moteur réel). */
  recompute(issueId?: string): Promise<Coverage | null>;
  /** Verdict du validateur sur la transition vers « Terminé ». */
  validate(configuration?: Record<string, unknown>): Promise<GateVerdict>;
  /** Fait arriver un résumé de CI : web trigger signé → file → consommateur. */
  runCi(summary: CiSummary): Promise<CiWebResponse>;
  /** Appelle un des sept outils Rovo/MCP via le vrai dispatch. */
  tool(name: string, payload: Record<string, unknown>, context?: ActorContext): Promise<unknown>;
  /** Geste humain du panneau via le vrai résolveur (`attest-criterion`, …). */
  gesture(key: string, payload: Record<string, unknown>, context?: unknown): Promise<unknown>;
  /** Émet un événement `avi:jira:updated:issue` (description modifiée). */
  emitIssueUpdated(): Promise<void>;
}

/** Contexte d'appel Forge : identité + module + provenance MCP. */
function forgeContext(accountId: string, fromMcp: boolean): ActorContext {
  return {
    accountId,
    moduleId: fromMcp ? 'rovo:mcp' : 'jira:issuePanel',
    fromMcp,
    cloudId: 'cloud-acceptance',
  };
}

/** Construit le harnais : scénario PAY-123 + vrais modules assemblés. */
export async function createAcceptanceHarness(start?: string): Promise<AcceptanceHarness> {
  const scenario = await createPay123Scenario(start);
  const { store, jira, checker, llm, identity, queue, clock, ids, logger } = scenario;

  // Le moteur de couverture RÉEL (lot L3) remplace le double du scénario :
  // c'est le point de passage obligé de la recette (SPEC §22 point 10).
  const coverage = createCoverageEngine({ store, clock, logger, jira });
  // L'authentification CI retrouve le projet par l'empreinte de la clé (§10).
  await store.saveSettings({ ...scenario.project, ciKeyHash: hashCiKey(CI_KEY) });

  const deps: AppDeps = { store, coverage, jira, checker, llm, identity, queue, clock, ids, logger };
  const resolver = new TestResolver();
  registerResolvers(resolver, deps);
  const validator = createValidator(deps);
  const mcpContext = forgeContext(scenario.actors.agent.accountId, true);

  return {
    scenario,
    deps,
    coverage,
    validator,
    resolver,
    queue,
    mcpContext,
    humanContext: forgeContext(scenario.actors.developer.accountId, false),
    testerContext: forgeContext(scenario.actors.tester.accountId, false),
    ownerContext: forgeContext(scenario.actors.owner.accountId, false),
    attachEvidence,
    changeCriterionText,
    canAttest,
    validateWaiverCandidate,
    findActiveWaiver,
    buildVersionDossier,
    renderDossierMarkdown,
    recompute: (issueId = ISSUE_ID) => coverage.recompute(issueId),
    validate: (configuration = {}) => validator(transitionInput(ISSUE_KEY, configuration)),
    runCi: (summary) => runCiThrough(deps, queue, clock.now(), summary),
    tool: (name, payload, context = mcpContext) => runAction(name, payload, deps, context),
    gesture: (key, payload, context = {}) => resolver.call(key, payload, context),
    emitIssueUpdated: () =>
      onJiraEvent(
        { issue: { id: ISSUE_ID, key: ISSUE_KEY }, changelog: { items: [{ field: 'description' }] } },
        deps,
      ),
  };
}

/** Charge utile du validateur pour la transition vers « Terminé » (SPEC §19). */
export function transitionInput(
  issueKey: string,
  configuration: Record<string, unknown> = {},
): ValidatorInput {
  return { issueKey, configuration, transition: { fromStatus: 'In Progress', toStatus: 'Done' } };
}

/**
 * Trajet complet d'un résumé de CI (SPEC §17, points 1 à 3) : le web trigger
 * vérifie la signature et range le message sur la file, puis le consommateur
 * met à jour les preuves de test et recalcule la couverture.
 */
async function runCiThrough(
  deps: AppDeps,
  queue: FakeQueue,
  nowIso: string,
  summary: CiSummary,
): Promise<CiWebResponse> {
  const response = await handleCiResults(signedCiRequest(JSON.stringify(summary), nowIso), deps);
  const pending: CiIngestMessage[] = queue.published.splice(0, queue.published.length);
  for (const message of pending) await onCiMessage(message, deps);
  return response;
}

/** Raccourcis stables utilisés par tous les fichiers de recette. */
export { ISSUE_ID, ISSUE_KEY, PROJECT_ID, PROJECT_KEY };
