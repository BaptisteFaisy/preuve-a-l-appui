/**
 * Le crochet du simulateur : l'état de la page, et rien d'autre.
 *
 * Le monde, les gestes et l'état affiché vivent dans `engine.ts` (testable
 * sans React) ; ce fichier ne garde que ce que la page doit savoir : le choix
 * du visiteur, l'état affiché et l'avancement de la construction.
 *
 * Le monde est construit UNE FOIS : changer de langue ne le reconstruit pas,
 * l'app reçoit simplement sa nouvelle langue (`setLanguage`, SPEC §20) et
 * l'état est relu. « Recommencer », lui, rebâtit le monde : la copie en
 * mémoire repart de l'instantané réel.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '../../../../../src/types.js';
import { setLanguage } from '../../../demo/actions.js';
import type { DemoWorld } from '../../../demo/world.js';
import {
  DEFAULT_CHOICE,
  attachProof,
  buildWorld,
  firstCriterionCode,
  renderWorld,
  type SimulatorChoice,
  type SimulatorRuntime,
} from './engine.js';

/** Ce que la section du simulateur manipule. */
export interface SimulatorApi {
  /** L'état affiché, `null` tant que le monde n'est pas prêt. */
  readonly runtime: SimulatorRuntime | null;
  /** Un geste est-il en cours ? */
  readonly busy: boolean;
  /** Le choix du visiteur. */
  readonly choice: SimulatorChoice;
  /** Change une partie du choix. */
  choose(patch: Partial<SimulatorChoice>): void;
  /** Applique le geste par le vrai chemin de l'app. */
  attach(): Promise<void>;
  /** Rebâtit le monde : l'état repart de l'instantané réel. */
  reset(): Promise<void>;
}

/** Porte le monde à la langue courante, puis relit l'état affiché. */
async function syncLanguage(
  world: DemoWorld,
  choice: SimulatorChoice,
  language: Language,
): Promise<SimulatorRuntime> {
  await setLanguage(world, language);
  return renderWorld(world, choice, language, null);
}

/** Un monde prêt à jouer : construit une fois, relu dans la langue courante. */
async function readyWorld(
  existing: DemoWorld | null,
  choice: SimulatorChoice,
  language: Language,
): Promise<{ world: DemoWorld; runtime: SimulatorRuntime; code: string }> {
  const world = existing ?? (await buildWorld(language));
  const code = await firstCriterionCode(world);
  const chosen = { ...choice, criterionCode: choice.criterionCode || code };
  const runtime = await syncLanguage(world, chosen, language);
  return { world, runtime, code };
}

export function useSimulator(language: Language): SimulatorApi {
  const [runtime, setRuntime] = useState<SimulatorRuntime | null>(null);
  const [choice, setChoice] = useState<SimulatorChoice>(DEFAULT_CHOICE);
  const [busy, setBusy] = useState(false);
  const worldRef = useRef<DemoWorld | null>(null);
  const choiceRef = useRef<SimulatorChoice>(DEFAULT_CHOICE);

  const choose = useCallback((patch: Partial<SimulatorChoice>): void => {
    const next = { ...choiceRef.current, ...patch };
    choiceRef.current = next;
    setChoice(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ready = await readyWorld(worldRef.current, choiceRef.current, language);
      if (cancelled) return;
      worldRef.current = ready.world;
      if (choiceRef.current.criterionCode === '') choose({ criterionCode: ready.code });
      setRuntime(ready.runtime);
    })();
    return () => {
      cancelled = true;
    };
  }, [language, choose]);

  const attach = useCallback(async (): Promise<void> => {
    const world = worldRef.current;
    if (!world) return;
    setBusy(true);
    try {
      const outcome = await attachProof(world, choiceRef.current);
      setRuntime(await renderWorld(world, choiceRef.current, language, outcome));
    } finally {
      setBusy(false);
    }
  }, [language]);

  const reset = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const ready = await readyWorld(null, DEFAULT_CHOICE, language);
      worldRef.current = ready.world;
      choiceRef.current = { ...DEFAULT_CHOICE, criterionCode: ready.code };
      setChoice(choiceRef.current);
      setRuntime(ready.runtime);
    } finally {
      setBusy(false);
    }
  }, [language]);

  return { runtime, busy, choice, choose, attach, reset };
}
