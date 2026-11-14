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
 * Lot `site-demo-live` : le monde est bâti sur l'instantané **relu à
 * l'exécution** (`live-fetch.ts`), retombe sur l'instantané embarqué à la
 * construction, puis sur le jeu PAY-123 du dépôt. La provenance et l'âge sont
 * affichés dans l'en-tête ; rien de tout cela n'est un scénario.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useCallback, useEffect, useState } from 'react';
import type { DemoSnapshotData } from '../../../src/demo-contract.js';
import type { Language } from '../../../src/types.js';
import { setLanguage, type DemoLogEntry } from './actions.js';
import { buildApi, type DemoApi } from './api.js';
import { reloadSnapshot } from './live-fetch.js';
import { bundledSnapshot } from './live-snapshot.js';
import { createLiveScenario } from './live-world.js';
import type { DemoSnapshot, RunContext } from './state.js';
import { snapshotOf } from './state.js';
import { useAdvanced } from './useAdvanced.js';
import { createDemoWorld, createWorld, type DemoWorld } from './world.js';

export type { DemoApi };

/** Un monde construit, prêt à afficher. */
interface Built {
  readonly world: DemoWorld;
  readonly snapshot: DemoSnapshot;
}

/** La ligne de journal d'une relecture ; aucune quand il n'y a rien à annoncer. */
function seedLog(note: string): DemoLogEntry[] {
  const entry = { id: 1, label: 'site:live-snapshot', detail: note, outcome: 'ok' as const };
  return note === '' ? [] : [entry];
}

/**
 * Un monde neuf : l'instantané relu en direct, sinon celui embarqué à la
 * construction, sinon le jeu PAY-123 du dépôt. Les trois câblent les mêmes
 * modules de l'app — seule la provenance change, et le bandeau la dit.
 */
async function freshWorld(lang: Language, note = ''): Promise<Built> {
  const reload = await reloadSnapshot();
  const fresh = reload.data;
  const data: DemoSnapshotData | null = fresh ?? bundledSnapshot();
  const error = fresh === null ? reload.error : '';
  const readAt = fresh === null ? (data?.generatedAt ?? '') : reload.readAt;
  const world = data
    ? await createWorld(await createLiveScenario(data, lang, error, readAt))
    : await createDemoWorld();
  await setLanguage(world, lang);
  const actor = world.scenario.actors.tester;
  const snapshot = await snapshotOf(world, actor, 'strict', lang, null, seedLog(note), false);
  return { world, snapshot };
}

export function useDemo(lang: Language): DemoApi {
  const [world, setWorld] = useState<DemoWorld | null>(null);
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [actorId, setActorId] = useState<string>('');

  /** Adopte un monde construit : mêmes trois réglages à chaque fois. */
  const adopt = useCallback((built: Built): void => {
    setWorld(built.world);
    setSnapshot(built.snapshot);
    setActorId(built.world.scenario.actors.tester.accountId);
  }, []);

  const ctx: RunContext | null = (() => {
    const actor =
      snapshot?.actors.find((one) => one.accountId === actorId) ?? snapshot?.actors[0] ?? null;
    return world && snapshot && actor ? { world, snapshot, actor, lang, apply: setSnapshot } : null;
  })();
  const advanced = useAdvanced(ctx, lang);

  /** Reconstruit le monde : `note` vide pour réinitialiser, sinon pour relire. */
  const rebuild = useCallback(
    async (note: string): Promise<void> => {
      adopt(await freshWorld(lang, note));
      advanced.clearAdvanced();
    },
    [lang, adopt, advanced],
  );

  useEffect(() => {
    let cancelled = false;
    void freshWorld(lang).then((built) => {
      if (!cancelled) adopt(built);
    });
    return () => {
      cancelled = true;
    };
    // La langue vient des réglages du projet : la changer reconstruit le monde
    // pour que les messages de l'app suivent (SPEC §20).
  }, [lang, adopt]);

  return buildApi({
    ctx,
    actorId,
    lang,
    advanced: advanced.advanced,
    setActor: setActorId,
    advancedRun: advanced.advancedRun,
    reset: () => rebuild(''),
    reload: () => rebuild('données relues depuis l’instantané publié'),
  });
}
