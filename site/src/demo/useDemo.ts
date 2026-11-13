/**
 * Le moteur de la démo, exposé comme un crochet React.
 *
 * Ce fichier ne tient que l'état : le monde (modules réels), l'instantané
 * affiché, l'acteur choisi. Les gestes vivent dans `api.ts` (panneau de base)
 * et `useAdvanced.ts` (gestes avancés) ; chacun passe par `play`
 * (`state.ts`), donc par les vrais handlers de l'app, puis par une relecture de
 * ce que l'app a rangé en base — jamais par un calcul parallèle (SPEC §12.3 :
 * une seule ligne de couverture).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Language } from '../../../src/types.js';
import { setLanguage } from './actions.js';
import { buildApi, type DemoApi } from './api.js';
import type { DemoSnapshot, RunContext } from './state.js';
import { snapshotOf } from './state.js';
import { useAdvanced } from './useAdvanced.js';
import { createDemoWorld, createWorld, type DemoWorld } from './world.js';
import { createLiveScenario } from './live-world.js';
import { bundledSnapshot } from './live-snapshot.js';

export type { DemoApi };

/**
 * Un monde neuf : l'état RÉEL de l'app installée s'il est embarqué dans le
 * site, sinon le jeu PAY-123 du dépôt. Les deux mondes câblent les mêmes
 * modules de l'app — seule la provenance change, et le bandeau de la démo la dit.
 */
async function freshWorld(lang: Language): Promise<{ world: DemoWorld; snapshot: DemoSnapshot }> {
  const live = bundledSnapshot();
  const world = live
    ? await createWorld(await createLiveScenario(live, lang))
    : await createDemoWorld();
  await setLanguage(world, lang);
  const actor = world.scenario.actors.tester;
  const snapshot = await snapshotOf(world, actor, 'strict', lang, null, [], false);
  return { world, snapshot };
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
  const gestures = useAdvanced(ctx, lang);

  const reset = useCallback(async (): Promise<void> => {
    const built = await freshWorld(lang);
    setWorld(built.world);
    setSnapshot(built.snapshot);
    setActorId(built.world.scenario.actors.tester.accountId);
    gestures.clearAdvanced();
  }, [lang, gestures]);

  return buildApi({
    ctx,
    actorId,
    lang,
    advanced: gestures.advanced,
    setActor: setActorId,
    advancedRun: gestures.advancedRun,
    reset,
  });
}
