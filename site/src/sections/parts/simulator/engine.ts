/**
 * Le moteur du simulateur : le monde, les gestes, l'état affiché.
 *
 * Aucune règle n'est réimplémentée ici :
 * - le monde est bâti par la MÊME fabrique que la démo (`createLiveScenario`
 *   puis `createWorld`), sur le MÊME instantané embarqué (`bundledSnapshot`) ;
 * - les gestes passent par les vrais handlers de l'app : le geste du panneau
 *   (`attach-evidence`, `attest-criterion`) ou l'outil MCP (`attach-evidence`),
 *   selon la personne qui joue ;
 * - l'état affiché vient de la ligne de couverture que le moteur de
 *   couverture a rangée, des view-models de l'app et du validateur.
 *
 * Les refus ne sont jamais rédigés ici : ils sont la réponse de l'app
 * (indépendance, droits d'attestation, agent qui ne déclare que).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Actor,
  Criterion,
  EvidenceType,
  GateMode,
  GateVerdict,
  Language,
} from '../../../../../src/types.js';
import { resolveCriterion } from '../../../../../src/actions/common.js';
import {
  agentTriesToAttest,
  attachTest,
  attest,
  setLanguage,
  tryDone,
  type GestureResult,
} from '../../../demo/actions.js';
import { bundledSnapshot } from '../../../demo/live-snapshot.js';
import { createLiveScenario } from '../../../demo/live-world.js';
import { snapshotOf } from '../../../demo/state.js';
import { createDemoWorld, createWorld, type DemoWorld } from '../../../demo/world.js';
import type { SimulatorRole } from '../../../i18n/simulator.js';
import { buildSimulatorView, type SimulatorView } from './viewmodel.js';

/** Ce que le visiteur choisit avant d'appuyer sur « attacher ». */
export interface SimulatorChoice {
  /** Le code stable du critère (`AC-1`), lisible partout (SPEC §8.1). */
  readonly criterionCode: string;
  /** Le type de preuve parmi les six du domaine. */
  readonly type: EvidenceType;
  /** Qui attache. */
  readonly role: SimulatorRole;
  /** La référence que l'app va vérifier. */
  readonly reference: string;
}

/** Le choix par défaut : le premier critère, une attestation, la testeuse. */
export const DEFAULT_CHOICE: SimulatorChoice = {
  criterionCode: '',
  type: 'attestation',
  role: 'tester',
  reference: '',
};

/** L'état affiché après un geste : la vue, le geste et le verdict. */
export interface SimulatorRuntime {
  readonly view: SimulatorView;
  readonly outcome: GestureResult | null;
  readonly verdict: GateVerdict | null;
}

/** L'acteur du rôle choisi : le casting vient du monde, jamais du site. */
export function actorFor(world: DemoWorld, role: SimulatorRole): Actor {
  const cast = world.scenario.actors;
  if (role === 'agent') return cast.agent;
  if (role === 'developer') return cast.developer;
  if (role === 'tester') return cast.tester;
  return cast.owner;
}

/**
 * Le monde du simulateur : celui de la démo, bâti sur le même instantané
 * réel. Les gestes du simulateur ne touchent que cette copie en mémoire.
 */
export async function buildWorld(language: Language): Promise<DemoWorld> {
  const live = bundledSnapshot();
  const world = live
    ? await createWorld(await createLiveScenario(live, language))
    : await createDemoWorld();
  await setLanguage(world, language);
  return world;
}

/** Le mode du projet, lu dans les réglages réels (SPEC §12.2). */
async function projectMode(world: DemoWorld): Promise<GateMode> {
  const settings = await world.deps.store.getSettings(world.scenario.project.projectId);
  return settings?.mode ?? 'strict';
}

/**
 * L'état affiché : la matrice, le champ de couverture et le verdict, tous
 * produits par l'app. Rien n'est recalculé par le site.
 */
export async function renderWorld(
  world: DemoWorld,
  choice: SimulatorChoice,
  language: Language,
  outcome: GestureResult | null,
): Promise<SimulatorRuntime> {
  const actor = actorFor(world, choice.role);
  const mode = await projectMode(world);
  const verdict = await tryDone(world, mode);
  const snapshot = await snapshotOf(world, actor, mode, language, verdict, [], false);
  const coverage = await world.coverage();
  const view = buildSimulatorView({
    coverage,
    matrix: snapshot.matrix,
    field: snapshot.field,
    actors: world.scenario.actors,
    language,
  });
  return { view, outcome, verdict };
}

/** Le code du premier critère actif du ticket : la valeur par défaut. */
export async function firstCriterionCode(world: DemoWorld): Promise<string> {
  const criteria = await world.deps.store.listCriteriaByIssue(world.scenario.issue.id);
  return criteria[0]?.code ?? '';
}

/** Une référence de repli, quand le visiteur n'en saisit pas. */
function defaultReference(type: EvidenceType, code: string): string {
  const slug = code.toLowerCase();
  if (type === 'test') return `${slug} automated test`;
  if (type === 'documentation') return `pay/docs/${slug}`;
  if (type === 'attachment') return `${slug}.png`;
  if (type === 'agent-report') return `report#${slug}`;
  if (type === 'link') return `https://example.test/${slug}`;
  return `attestation#${slug}`;
}

/** Le geste d'une personne, par le geste du panneau : la force est calculée. */
async function panelAttach(
  world: DemoWorld,
  actor: Actor,
  criterion: Criterion,
  type: EvidenceType,
  reference: string,
): Promise<GestureResult> {
  const response = (await world.resolver.call('attach-evidence', {
    issueId: world.scenario.issue.id,
    projectId: world.scenario.project.projectId,
    accountId: actor.accountId,
    criterionId: criterion.id,
    type,
    reference,
  })) as { ok?: boolean; reason?: string };
  if (response.ok === false) return { outcome: 'refused', detail: response.reason ?? '' };
  return { outcome: 'ok', detail: '' };
}

/** Le geste de l'agent, par l'outil MCP : il ne déclare jamais plus (§9.1). */
async function agentAttach(
  world: DemoWorld,
  criterion: Criterion,
  type: EvidenceType,
  reference: string,
): Promise<GestureResult> {
  const context = world.agentContext(world.scenario.actors.agent.accountId);
  try {
    const answer = (await world.tool(
      'attach-evidence',
      {
        issueKey: world.scenario.issue.key,
        criterionId: criterion.id,
        type,
        reference,
      },
      context,
    )) as { text?: string };
    return { outcome: 'ok', detail: answer.text ?? '' };
  } catch (error) {
    return { outcome: 'refused', detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Le geste du visiteur, par le vrai chemin de l'app :
 * - l'attestation passe par le geste du panneau, qui vérifie l'indépendance
 *   (`canAttest`, SPEC §9.4) ;
 * - un agent passe par l'outil MCP, qui refuse d'attester (§15, §22) ;
 * - le reste passe par le geste du panneau, qui calcule la force (§9.1).
 */
export async function attachProof(
  world: DemoWorld,
  choice: SimulatorChoice,
): Promise<GestureResult> {
  const actor = actorFor(world, choice.role);
  const criterion = await resolveCriterion(world.deps, world.scenario.issue, choice.criterionCode);
  const reference = choice.reference.trim() || defaultReference(choice.type, criterion.code);
  if (choice.type === 'attestation') {
    if (actor.agent) return agentTriesToAttest(world, criterion.id, actor.accountId);
    return attest(world, criterion.id, actor.accountId);
  }
  if (actor.agent) return agentAttach(world, criterion, choice.type, reference);
  if (choice.type === 'test') {
    return attachTest(world, criterion.id, reference, actor.accountId);
  }
  return panelAttach(world, actor, criterion, choice.type, reference);
}
