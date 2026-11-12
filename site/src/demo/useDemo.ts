/**
 * Le moteur de la démo, exposé comme un crochet React.
 *
 * Tout l'état vit ici : monde (modules réels), instantané affiché, journal.
 * Chaque geste passe par les vrais handlers de l'app, puis l'instantané est
 * reconstruit à partir de ce que l'app a rangé en base — jamais à partir d'un
 * calcul parallèle (SPEC §12.3 : une seule ligne de couverture).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Actor, GateMode, GateVerdict, Language } from '../../../src/types.js';
import {
  agentTriesToAttest,
  askAgent,
  attachTest,
  attest,
  runPipeline,
  setLanguage,
  setMode,
  tryDone,
  waive,
  type DemoLogEntry,
  type GestureResult,
} from './actions.js';
import { snapshotOf, withLog, type DemoSnapshot } from './state.js';
import { createDemoWorld, type DemoWorld } from './world.js';

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
  reset(): Promise<void>;
}

interface RunContext {
  readonly world: DemoWorld;
  readonly snapshot: DemoSnapshot;
  readonly actor: Actor;
  readonly lang: Language;
  readonly apply: (next: DemoSnapshot) => void;
}

/** Un monde neuf, réglé sur la langue demandée, avec son premier instantané. */
async function freshWorld(lang: Language): Promise<{ world: DemoWorld; snapshot: DemoSnapshot }> {
  const world = await createDemoWorld();
  await setLanguage(world, lang);
  const actor = world.scenario.actors.tester;
  const snapshot = await snapshotOf(world, actor, 'strict', lang, null, [], false);
  return { world, snapshot };
}

/** Joue un geste, journalise son résultat, puis relit l'état réel de l'app. */
async function play(ctx: RunContext, label: string, gesture: (w: DemoWorld) => Promise<GestureResult>): Promise<void> {
  ctx.apply({ ...ctx.snapshot, busy: true });
  const result = await gesture(ctx.world);
  const entry: DemoLogEntry = { id: 0, label, detail: result.detail, outcome: result.outcome };
  const log = withLog(ctx.snapshot.log, entry);
  ctx.apply(await snapshotOf(ctx.world, ctx.actor, ctx.snapshot.mode, ctx.lang, ctx.snapshot.verdict, log, false));
}

/** Tente la transition : le verdict du validateur entre au journal. */
async function closeTicket(ctx: RunContext): Promise<void> {
  const verdict: GateVerdict = await tryDone(ctx.world, ctx.snapshot.mode);
  const entry: DemoLogEntry = {
    id: 0,
    label: 'jira:workflowValidator',
    detail: verdict.result ? 'transition allowed' : verdict.errorMessage,
    outcome: verdict.result ? 'ok' : 'refused',
  };
  const log = withLog(ctx.snapshot.log, entry);
  ctx.apply(await snapshotOf(ctx.world, ctx.actor, ctx.snapshot.mode, ctx.lang, verdict, log, false));
}

export function useDemo(lang: Language): DemoApi {
  const [world, setWorld] = useState<DemoWorld | null>(null);
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [actorId, setActorId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void freshWorld(lang).then((built) => {
      if (cancelled) return;
      setWorld(built.world);
      setSnapshot(built.snapshot);
      setActorId(built.world.scenario.actors.tester.accountId);
    });
    return () => {
      cancelled = true;
    };
    // La langue vient des réglages du projet : la changer reconstruit le monde
    // pour que les messages de l'app suivent (SPEC §20).
  }, [lang]);

  const actor = snapshot?.actors.find((one) => one.accountId === actorId) ?? snapshot?.actors[0] ?? null;
  const ctx: RunContext | null =
    world && snapshot && actor ? { world, snapshot, actor, lang, apply: setSnapshot } : null;

  const run = useCallback(
    (label: string, gesture: (w: DemoWorld) => Promise<GestureResult>) =>
      ctx ? play(ctx, label, gesture) : Promise.resolve(),
    [ctx],
  );

  return {
    snapshot,
    setActor: setActorId,
    chooseMode: (next: GateMode) =>
      run('save-project-settings', async (w) => {
        const result = await setMode(w, next);
        return result;
      }),
    attach: (id, testName) => run('attach-evidence', (w) => attachTest(w, id, testName, actorId)),
    attestCriterion: (id) => run('attest-criterion', (w) => attest(w, id, actorId)),
    waiveCriterion: (id, reason) => run('waive-criterion', (w) => waive(w, id, reason, actorId)),
    runCi: (mainBranch) => run('consumer proof-ci', (w) => runPipeline(w, mainBranch)),
    close: () => (ctx ? closeTicket(ctx) : Promise.resolve()),
    ask: () => run('get-proof-status', (w) => askAgent(w, w.scenario.actors.agent.accountId)),
    agentAttempt: (id) =>
      run('attach-evidence via MCP', (w) => agentTriesToAttest(w, id, w.scenario.actors.agent.accountId)),
    reset: async () => {
      const built = await freshWorld(lang);
      setWorld(built.world);
      setSnapshot(built.snapshot);
      setActorId(built.world.scenario.actors.tester.accountId);
    },
  };
}
