/**
 * L'API de la démo, séparée du crochet React : chaque geste passe par `play`
 * (donc par les vrais handlers de l'app), puis l'instantané est reconstruit à
 * partir de ce que l'app a rangé en base — jamais d'un calcul parallèle.
 *
 * Découpé depuis `useDemo.ts` pour tenir la limite de 50 lignes par fonction
 * (docs/CONVENTIONS.md).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { GateMode, GateVerdict, Language } from '../../../src/types.js';
import {
  agentTriesToAttest,
  askAgent,
  attachTest,
  attest,
  runPipeline,
  setMode,
  tryDone,
  waive,
  type GestureResult,
} from './actions.js';
import { play, withLog, snapshotOf, type DemoSnapshot, type RunContext } from './state.js';
import type { DemoWorld } from './world.js';

/** Ce que la démo expose au composant. */
export interface DemoApi {
  readonly snapshot: DemoSnapshot | null;
  setActor(accountId: string): void;
  /** Change le mode du projet (SPEC §12.2) : écrit dans les réglages réels. */
  chooseMode(mode: GateMode): Promise<void>;
  attach(criterionId: string, testName: string): Promise<void>;
  attestCriterion(criterionId: string): Promise<void>;
  waiveCriterion(criterionId: string, reason: string): Promise<void>;
  runCi(mainBranch: boolean): Promise<void>;
  close(): Promise<void>;
  ask(): Promise<void>;
  agentAttempt(criterionId: string): Promise<void>;
  /** Résultat du dernier passage de chaque geste avancé, par identifiant. */
  readonly advanced: Readonly<Record<string, GestureResult>>;
  advancedRun(id: string): Promise<void>;
  reset(): Promise<void>;
  /** Relit l'instantané publié et reconstruit le monde dessus. */
  reload(): Promise<void>;
}

/** Ce dont l'API a besoin : contexte courant, acteur choisi, langue, gestes. */
export interface ApiParams {
  readonly ctx: RunContext | null;
  readonly actorId: string;
  readonly lang: Language;
  readonly advanced: Readonly<Record<string, GestureResult>>;
  setActor(accountId: string): void;
  advancedRun(id: string): Promise<void>;
  reset(): Promise<void>;
  reload(): Promise<void>;
}

/** Tente la transition : le verdict du validateur entre au journal. */
async function closeTicket(ctx: RunContext): Promise<void> {
  const verdict: GateVerdict = await tryDone(ctx.world, ctx.snapshot.mode);
  const entry = {
    id: 0,
    label: 'jira:workflowValidator',
    detail: verdict.result ? 'transition allowed' : verdict.errorMessage,
    outcome: verdict.result ? ('ok' as const) : ('refused' as const),
  };
  const log = withLog(ctx.snapshot.log, entry);
  ctx.apply(await snapshotOf(ctx.world, ctx.actor, ctx.snapshot.mode, ctx.lang, verdict, log, false));
}

/** Construit l'API : un champ par geste, tous câblés sur les vrais modules. */
export function buildApi(params: ApiParams): DemoApi {
  const { ctx, actorId, advanced } = params;
  const run = (label: string, gesture: (world: DemoWorld) => Promise<GestureResult>) =>
    ctx ? play(ctx, label, gesture) : Promise.resolve();
  return {
    snapshot: ctx?.snapshot ?? null,
    setActor: params.setActor,
    chooseMode: (next: GateMode) => run('save-project-settings', (w) => setMode(w, next)),
    attach: (id, testName) => run('attach-evidence', (w) => attachTest(w, id, testName, actorId)),
    attestCriterion: (id) => run('attest-criterion', (w) => attest(w, id, actorId)),
    waiveCriterion: (id, reason) => run('waive-criterion', (w) => waive(w, id, reason, actorId)),
    runCi: (mainBranch) => run('consumer proof-ci', (w) => runPipeline(w, mainBranch)),
    close: () => (ctx ? closeTicket(ctx) : Promise.resolve()),
    ask: () => run('get-proof-status', (w) => askAgent(w, w.scenario.actors.agent.accountId)),
    agentAttempt: (id) =>
      run('attach-evidence via MCP', (w) =>
        agentTriesToAttest(w, id, w.scenario.actors.agent.accountId),
      ),
    advanced,
    advancedRun: params.advancedRun,
    reset: params.reset,
    reload: params.reload,
  };
}
